import { Router, type Request } from 'express';
import { Task, TASK_PRIORITIES, TASK_VISIBILITIES } from '../models/Task.js';
import { TaskComment } from '../models/TaskComment.js';
import { TaskAttachment, MAX_ATTACHMENT_BYTES } from '../models/TaskAttachment.js';
import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { toPublicUser } from '../services/userService.js';
import { isValidStatus } from '../services/statusService.js';
import { logTaskActivity, diffTaskActivities } from '../services/taskActivityService.js';
import { requirePermission } from '../middleware/requirePermission.js';

const denied = (action: string) => ({
  code: 'PERMISSION_DENIED' as const,
  error: `You don't have permission to ${action}. Ask the workspace owner to grant it.`,
});

type WorkspaceParams = { workspaceId: string };
type TaskParams = { workspaceId: string; taskId: string };

const router = Router({ mergeParams: true });

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A task counts as a duplicate when another task in the same project (or the
 *  same "no project" bucket) has the same name, ignoring case and surrounding
 *  whitespace. Scoped to the workspace, so it catches duplicates no matter
 *  which member is adding the task. */
async function findDuplicateTask(workspaceId: string, name: string, projectId: string | null) {
  return Task.findOne({
    workspaceId,
    projectId: projectId ?? null,
    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
  });
}

router.get('/', async (req: Request<WorkspaceParams>, res) => {
  const { workspaceId } = req.params;
  const { status, assigneeId, priority, projectId } = req.query;

  const filter: Record<string, unknown> = { workspaceId };
  if (status) filter.status = status;
  if (assigneeId) filter.assigneeId = assigneeId;
  if (priority) filter.priority = priority;
  if (projectId) filter.projectId = projectId;

  const tasks = await Task.find(filter).sort({ order: 1, createdAt: -1 });
  res.json({ tasks });
});

// Check whether a task name is already taken in a project, without creating
// anything. Used by the client for an instant warning before it submits.
router.get('/check-duplicate', async (req: Request<WorkspaceParams>, res) => {
  const name = String(req.query.name ?? '');
  if (!name.trim()) return res.json({ duplicate: null });
  const projectId = req.query.projectId ? String(req.query.projectId) : null;
  const existing = await findDuplicateTask(req.params.workspaceId, name, projectId);
  res.json({
    duplicate: existing
      ? { id: String(existing._id), name: existing.name, status: existing.status }
      : null,
  });
});

router.post('/', requirePermission('manageTasks'), async (req: Request<WorkspaceParams>, res) => {
  const { name, description, status, priority, dueDate, assigneeId, projectId, force } = req.body ?? {};

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Task name is required.' });
  }
  if (assigneeId && !req.workspacePermissions?.assignTasks) {
    return res.status(403).json(denied('assign tasks'));
  }
  if (status && !(await isValidStatus(req.params.workspaceId, 'task', status))) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (priority && !TASK_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority.' });
  }

  // Block accidental duplicates unless the client explicitly opts in with `force`.
  if (!force) {
    const existing = await findDuplicateTask(req.params.workspaceId, name, projectId || null);
    if (existing) {
      return res.status(409).json({
        error: 'This task already exists. Adding it again will create a duplicate.',
        code: 'DUPLICATE_TASK',
        existing: { id: String(existing._id), name: existing.name, status: existing.status },
      });
    }
  }

  // New tasks float to the top of their column: one step below the current min.
  const effectiveStatus = status ?? 'pending';
  const top = await Task.findOne({ workspaceId: req.params.workspaceId, status: effectiveStatus })
    .sort({ order: 1 })
    .select('order');

  const task = await Task.create({
    workspaceId: req.params.workspaceId,
    projectId: projectId || null,
    name: name.trim(),
    description: description ?? '',
    status: effectiveStatus,
    priority: priority ?? 'normal',
    order: top ? top.order - 1 : 0,
    dueDate: dueDate ?? null,
    assigneeId: assigneeId || null,
    createdBy: req.userId,
  });

  logTaskActivity({
    workspaceId: req.params.workspaceId,
    projectId: task.projectId ? String(task.projectId) : null,
    taskId: String(task._id),
    taskName: task.name,
    actorId: req.userId!,
    action: 'task_created',
    meta: { status: task.status, priority: task.priority, forced: Boolean(force) },
  });

  res.status(201).json({ task });
});

// Persist a manual drag-and-drop ordering. `ids` is the full ordered list of
// task ids for a single column; when `status` is given every task in the list
// is moved onto it (covers a card dragged between columns).
router.put('/reorder', requirePermission('manageTasks'), async (req: Request<WorkspaceParams>, res) => {
  const { status, ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'ids must be an array of task ids.' });
  }
  if (status !== undefined && !(await isValidStatus(req.params.workspaceId, 'task', status))) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  if (ids.length) {
    // A drag between columns changes status — record that for the activity feed.
    if (status !== undefined) {
      const moving = await Task.find({
        _id: { $in: ids },
        workspaceId: req.params.workspaceId,
        status: { $ne: status },
      });
      logTaskActivity(
        moving.map((t) => ({
          workspaceId: req.params.workspaceId,
          projectId: t.projectId ? String(t.projectId) : null,
          taskId: String(t._id),
          taskName: t.name,
          actorId: req.userId!,
          action: status === 'completed' ? 'task_completed' : t.status === 'completed' ? 'task_reopened' : 'task_status_changed',
          meta: { from: t.status, to: status, assigneeId: t.assigneeId ? String(t.assigneeId) : null },
        })),
      );
    }

    await Task.bulkWrite(
      ids.map((id: string, i: number) => ({
        updateOne: {
          filter: { _id: id, workspaceId: req.params.workspaceId },
          update: { $set: { order: i, ...(status !== undefined ? { status } : {}) } },
        },
      })),
    );
  }

  const tasks = await Task.find({ workspaceId: req.params.workspaceId }).sort({ order: 1, createdAt: -1 });
  res.json({ tasks });
});

router.get('/:taskId', async (req: Request<TaskParams>, res) => {
  const task = await Task.findOne({ _id: req.params.taskId, workspaceId: req.params.workspaceId });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

router.patch('/:taskId', async (req: Request<TaskParams>, res) => {
  const { name, description, status, priority, dueDate, assigneeId, projectId } = req.body ?? {};

  // Changing the assignee needs "assign tasks"; changing anything else needs
  // "create or edit tasks".
  const touchesAssignee = assigneeId !== undefined;
  const touchesOther = [name, description, status, priority, dueDate, projectId].some((v) => v !== undefined);
  if (touchesAssignee && !req.workspacePermissions?.assignTasks) {
    return res.status(403).json(denied('assign tasks'));
  }
  if (touchesOther && !req.workspacePermissions?.manageTasks) {
    return res.status(403).json(denied('edit tasks'));
  }

  if (status && !(await isValidStatus(req.params.workspaceId, 'task', status))) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  if (priority && !TASK_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority.' });
  }

  const before = await Task.findOne({ _id: req.params.taskId, workspaceId: req.params.workspaceId });
  if (!before) return res.status(404).json({ error: 'Task not found' });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (priority !== undefined) updates.priority = priority;
  if (dueDate !== undefined) updates.dueDate = dueDate;
  if (assigneeId !== undefined) updates.assigneeId = assigneeId || null;
  if (projectId !== undefined) updates.projectId = projectId || null;

  const task = await Task.findOneAndUpdate(
    { _id: req.params.taskId, workspaceId: req.params.workspaceId },
    updates,
    { new: true },
  );
  if (!task) return res.status(404).json({ error: 'Task not found' });

  logTaskActivity(
    diffTaskActivities({
      workspaceId: req.params.workspaceId,
      actorId: req.userId!,
      before: {
        _id: before._id,
        name: before.name,
        status: before.status,
        priority: before.priority,
        assigneeId: before.assigneeId,
        dueDate: before.dueDate,
        projectId: before.projectId,
        description: before.description,
      },
      patch: updates,
    }),
  );

  res.json({ task });
});

router.delete('/:taskId', requirePermission('deleteItems'), async (req: Request<TaskParams>, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.taskId, workspaceId: req.params.workspaceId });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // The task is gone — clean up its comments and attachments too.
  void TaskComment.deleteMany({ taskId: task._id }).catch(() => {});
  void TaskAttachment.deleteMany({ taskId: task._id }).catch(() => {});

  logTaskActivity({
    workspaceId: req.params.workspaceId,
    projectId: task.projectId ? String(task.projectId) : null,
    taskId: String(task._id),
    taskName: task.name,
    actorId: req.userId!,
    action: 'task_deleted',
    meta: { status: task.status },
  });

  res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────────────
// Two-panel Tasks page: comments, attachments, followers, visibility.
// All of these live on new routes / collections and never change the behaviour
// of the task CRUD above.
// ─────────────────────────────────────────────────────────────────────────────

type CommentParams = { workspaceId: string; taskId: string; commentId: string };
type AttachmentParams = { workspaceId: string; taskId: string; attachmentId: string };
type FollowerParams = { workspaceId: string; taskId: string; userId: string };

/** Load a task scoped to the workspace, or send 404. */
async function loadTask(workspaceId: string, taskId: string) {
  return Task.findOne({ _id: taskId, workspaceId });
}

const activityBase = (
  workspaceId: string,
  task: { _id: unknown; name: string; projectId?: unknown },
  actorId: string,
) => ({
  workspaceId,
  projectId: task.projectId ? String(task.projectId) : null,
  taskId: String(task._id),
  taskName: task.name,
  actorId,
});

// ── Comments ────────────────────────────────────────────────────────────────
router.get('/:taskId/comments', async (req: Request<TaskParams>, res) => {
  const task = await loadTask(req.params.workspaceId, req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const comments = await TaskComment.find({ taskId: task._id }).sort({ createdAt: 1 });
  const authorIds = [...new Set(comments.map((c) => String(c.authorId)))];
  const users = await User.find({ _id: { $in: authorIds } });
  const byId = new Map(users.map((u) => [String(u._id), toPublicUser(u)]));

  res.json({
    comments: comments.map((c) => ({
      id: String(c._id),
      taskId: String(c.taskId),
      authorId: String(c.authorId),
      body: c.body,
      createdAt: c.createdAt,
      author: byId.get(String(c.authorId)) ?? null,
    })),
  });
});

router.post('/:taskId/comments', async (req: Request<TaskParams>, res) => {
  const body = String(req.body?.body ?? '').trim();
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty.' });
  if (body.length > 5000) return res.status(400).json({ error: 'Comment is too long.' });

  const task = await loadTask(req.params.workspaceId, req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const comment = await TaskComment.create({
    workspaceId: req.params.workspaceId,
    taskId: task._id,
    authorId: req.userId,
    body,
  });

  logTaskActivity({
    ...activityBase(req.params.workspaceId, task, req.userId!),
    action: 'task_comment_added',
    meta: {},
  });

  const author = await User.findById(req.userId);
  res.status(201).json({
    comment: {
      id: String(comment._id),
      taskId: String(comment.taskId),
      authorId: String(comment.authorId),
      body: comment.body,
      createdAt: comment.createdAt,
      author: author ? toPublicUser(author) : null,
    },
  });
});

router.delete('/:taskId/comments/:commentId', async (req: Request<CommentParams>, res) => {
  const comment = await TaskComment.findOne({
    _id: req.params.commentId,
    taskId: req.params.taskId,
    workspaceId: req.params.workspaceId,
  });
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  const isAuthor = String(comment.authorId) === req.userId;
  if (!isAuthor && !req.workspacePermissions?.deleteItems) {
    return res.status(403).json(denied('delete this comment'));
  }
  await comment.deleteOne();
  res.status(204).end();
});

// ── Attachments ─────────────────────────────────────────────────────────────
router.get('/:taskId/attachments', async (req: Request<TaskParams>, res) => {
  const task = await loadTask(req.params.workspaceId, req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const attachments = await TaskAttachment.find({ taskId: task._id }).sort({ createdAt: 1 });
  const uploaderIds = [...new Set(attachments.map((a) => String(a.uploadedBy)))];
  const users = await User.find({ _id: { $in: uploaderIds } });
  const byId = new Map(users.map((u) => [String(u._id), toPublicUser(u)]));

  res.json({
    attachments: attachments.map((a) => ({
      id: String(a._id),
      taskId: String(a.taskId),
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
      uploadedBy: String(a.uploadedBy),
      createdAt: a.createdAt,
      uploader: byId.get(String(a.uploadedBy)) ?? null,
    })),
  });
});

router.post('/:taskId/attachments', requirePermission('manageTasks'), async (req: Request<TaskParams>, res) => {
  const { name, mimeType, size, data } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || typeof data !== 'string' || !data) {
    return res.status(400).json({ error: 'A file name and contents are required.' });
  }
  // `data` is base64 (~4/3 of the original). Guard on the decoded size.
  const approxBytes = Math.floor((data.length * 3) / 4);
  if (approxBytes > MAX_ATTACHMENT_BYTES) {
    return res.status(413).json({ error: 'That file is larger than the 5 MB limit.' });
  }

  const task = await loadTask(req.params.workspaceId, req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const attachment = await TaskAttachment.create({
    workspaceId: req.params.workspaceId,
    taskId: task._id,
    uploadedBy: req.userId,
    name: String(name).trim().slice(0, 260),
    mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'application/octet-stream',
    size: typeof size === 'number' && size >= 0 ? size : approxBytes,
    data,
  });

  logTaskActivity({
    ...activityBase(req.params.workspaceId, task, req.userId!),
    action: 'task_attachment_added',
    meta: { name: attachment.name },
  });

  const uploader = await User.findById(req.userId);
  res.status(201).json({
    attachment: {
      id: String(attachment._id),
      taskId: String(attachment.taskId),
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      uploadedBy: String(attachment.uploadedBy),
      createdAt: attachment.createdAt,
      uploader: uploader ? toPublicUser(uploader) : null,
    },
  });
});

router.get('/:taskId/attachments/:attachmentId/download', async (req: Request<AttachmentParams>, res) => {
  const attachment = await TaskAttachment.findOne({
    _id: req.params.attachmentId,
    taskId: req.params.taskId,
    workspaceId: req.params.workspaceId,
  });
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

  res.json({
    attachment: {
      id: String(attachment._id),
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      data: attachment.data,
    },
  });
});

router.delete('/:taskId/attachments/:attachmentId', async (req: Request<AttachmentParams>, res) => {
  const attachment = await TaskAttachment.findOne({
    _id: req.params.attachmentId,
    taskId: req.params.taskId,
    workspaceId: req.params.workspaceId,
  });
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

  const isUploader = String(attachment.uploadedBy) === req.userId;
  if (!isUploader && !req.workspacePermissions?.deleteItems) {
    return res.status(403).json(denied('delete this attachment'));
  }

  const task = await loadTask(req.params.workspaceId, req.params.taskId);
  await attachment.deleteOne();

  if (task) {
    logTaskActivity({
      ...activityBase(req.params.workspaceId, task, req.userId!),
      action: 'task_attachment_removed',
      meta: { name: attachment.name },
    });
  }
  res.status(204).end();
});

// ── Followers ───────────────────────────────────────────────────────────────
router.post('/:taskId/followers', async (req: Request<TaskParams>, res) => {
  const targetId = String(req.body?.userId ?? req.userId);
  const isSelf = targetId === req.userId;
  // Following yourself is always allowed; adding someone else needs task edit rights.
  if (!isSelf && !req.workspacePermissions?.manageTasks) {
    return res.status(403).json(denied('add followers to this task'));
  }

  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace?.members.some((m) => String(m.userId) === targetId)) {
    return res.status(400).json({ error: 'That user is not a member of this workspace.' });
  }

  const task = await Task.findOneAndUpdate(
    { _id: req.params.taskId, workspaceId: req.params.workspaceId },
    { $addToSet: { followers: targetId } },
    { new: true },
  );
  if (!task) return res.status(404).json({ error: 'Task not found' });

  logTaskActivity({
    ...activityBase(req.params.workspaceId, task, req.userId!),
    action: 'task_follower_added',
    meta: { userId: targetId, self: isSelf },
  });
  res.json({ task });
});

router.delete('/:taskId/followers/:userId', async (req: Request<FollowerParams>, res) => {
  const isSelf = req.params.userId === req.userId;
  if (!isSelf && !req.workspacePermissions?.manageTasks) {
    return res.status(403).json(denied('remove followers from this task'));
  }

  const task = await Task.findOneAndUpdate(
    { _id: req.params.taskId, workspaceId: req.params.workspaceId },
    { $pull: { followers: req.params.userId } },
    { new: true },
  );
  if (!task) return res.status(404).json({ error: 'Task not found' });

  logTaskActivity({
    ...activityBase(req.params.workspaceId, task, req.userId!),
    action: 'task_follower_removed',
    meta: { userId: req.params.userId, self: isSelf },
  });
  res.json({ task });
});

// ── Subtasks (checklist) ────────────────────────────────────────────────────
type SubtaskParams = { workspaceId: string; taskId: string; subtaskId: string };

router.post('/:taskId/subtasks', requirePermission('manageTasks'), async (req: Request<TaskParams>, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title) return res.status(400).json({ error: 'Subtask title is required.' });
  if (title.length > 500) return res.status(400).json({ error: 'Subtask title is too long.' });

  const task = await loadTask(req.params.workspaceId, req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const maxOrder = task.subtasks.reduce((m, s) => Math.max(m, s.order ?? 0), -1);
  task.subtasks.push({ title, order: maxOrder + 1, createdBy: req.userId } as never);
  await task.save();

  logTaskActivity({
    ...activityBase(req.params.workspaceId, task, req.userId!),
    action: 'task_subtask_added',
    meta: { title },
  });
  res.status(201).json({ task });
});

router.patch('/:taskId/subtasks/:subtaskId', requirePermission('manageTasks'), async (req: Request<SubtaskParams>, res) => {
  const task = await loadTask(req.params.workspaceId, req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const sub = task.subtasks.id(req.params.subtaskId);
  if (!sub) return res.status(404).json({ error: 'Subtask not found' });

  const { title, done } = req.body ?? {};
  let toggled: 'done' | 'reopened' | null = null;

  if (typeof title === 'string' && title.trim()) sub.title = title.trim().slice(0, 500);
  if (typeof done === 'boolean' && done !== sub.done) {
    sub.done = done;
    sub.completedAt = done ? new Date() : null;
    toggled = done ? 'done' : 'reopened';
  }
  await task.save();

  if (toggled) {
    logTaskActivity({
      ...activityBase(req.params.workspaceId, task, req.userId!),
      action: toggled === 'done' ? 'task_subtask_completed' : 'task_subtask_reopened',
      meta: { title: sub.title },
    });
  }
  res.json({ task });
});

router.delete('/:taskId/subtasks/:subtaskId', requirePermission('manageTasks'), async (req: Request<SubtaskParams>, res) => {
  const task = await loadTask(req.params.workspaceId, req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const sub = task.subtasks.id(req.params.subtaskId);
  if (!sub) return res.status(404).json({ error: 'Subtask not found' });

  const title = sub.title;
  sub.deleteOne();
  await task.save();

  logTaskActivity({
    ...activityBase(req.params.workspaceId, task, req.userId!),
    action: 'task_subtask_removed',
    meta: { title },
  });
  res.json({ task });
});

// ── Visibility ──────────────────────────────────────────────────────────────
router.patch('/:taskId/visibility', requirePermission('manageTasks'), async (req: Request<TaskParams>, res) => {
  const visibility = String(req.body?.visibility ?? '');
  if (!TASK_VISIBILITIES.includes(visibility as (typeof TASK_VISIBILITIES)[number])) {
    return res.status(400).json({ error: 'Invalid visibility.' });
  }

  const before = await loadTask(req.params.workspaceId, req.params.taskId);
  if (!before) return res.status(404).json({ error: 'Task not found' });

  const task = await Task.findOneAndUpdate(
    { _id: req.params.taskId, workspaceId: req.params.workspaceId },
    { visibility },
    { new: true },
  );
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (before.visibility !== visibility) {
    logTaskActivity({
      ...activityBase(req.params.workspaceId, task, req.userId!),
      action: 'task_visibility_changed',
      meta: { from: before.visibility, to: visibility },
    });
  }
  res.json({ task });
});

export default router;
