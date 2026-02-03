const crypto = require('crypto');
const configStore = require('./configStore');
const { forwardSelfLog } = require('./logger');

const NOTES_KEY = 'projectNotes';

function createEmptyState() {
  return { projects: {}, updatedAt: new Date().toISOString() };
}

function normalizeNote(note) {
  if (!note) return null;
  return {
    id: note.id,
    title: note.title || 'Untitled',
    category: note.category || 'Custom',
    text: note.text || '',
    attachments: Array.isArray(note.attachments) ? note.attachments : [],
    status: note.status || 'OPEN',
    createdAt: note.createdAt || new Date().toISOString(),
    doneAt: note.doneAt || null,
    nextAction: note.nextAction || '',
    backups: Array.isArray(note.backups) ? note.backups : [],
  };
}

async function loadNotesState() {
  const data = await configStore.loadJson(NOTES_KEY);
  if (!data || typeof data !== 'object') {
    return createEmptyState();
  }
  if (!data.projects || typeof data.projects !== 'object') {
    return createEmptyState();
  }
  return data;
}

async function saveNotesState(state) {
  const payload = state || createEmptyState();
  payload.updatedAt = new Date().toISOString();
  try {
    await configStore.saveJson(NOTES_KEY, payload);
  } catch (error) {
    console.error('[notesStore] Failed to save notes', error);
    await forwardSelfLog('error', 'Failed to save notes', {
      stack: error?.stack,
      context: { error: error?.message },
    });
    throw error;
  }
}

function ensureProjectState(state, projectId) {
  if (!state.projects[projectId]) {
    state.projects[projectId] = { notes: [] };
  }
  if (!Array.isArray(state.projects[projectId].notes)) {
    state.projects[projectId].notes = [];
  }
  return state.projects[projectId];
}

async function listNotes(projectId, status) {
  const state = await loadNotesState();
  const project = state.projects?.[projectId];
  const notes = Array.isArray(project?.notes) ? project.notes.map(normalizeNote).filter(Boolean) : [];
  if (!status) return notes;
  return notes.filter((note) => note.status === status);
}

async function getNote(projectId, noteId) {
  if (!noteId) return null;
  const state = await loadNotesState();
  const project = state.projects?.[projectId];
  if (!project?.notes) return null;
  const note = project.notes.find((entry) => entry.id === noteId);
  return normalizeNote(note);
}

async function createNote(projectId, payload) {
  const state = await loadNotesState();
  const project = ensureProjectState(state, projectId);
  const note = normalizeNote({
    ...payload,
    id: crypto.randomUUID(),
    status: payload.status || 'OPEN',
    createdAt: new Date().toISOString(),
  });
  project.notes.unshift(note);
  await saveNotesState(state);
  return note;
}

async function updateNote(projectId, noteId, updates) {
  const state = await loadNotesState();
  const project = ensureProjectState(state, projectId);
  const idx = project.notes.findIndex((entry) => entry.id === noteId);
  if (idx === -1) return null;
  const existing = normalizeNote(project.notes[idx]);
  const updated = normalizeNote({ ...existing, ...updates });
  project.notes[idx] = updated;
  await saveNotesState(state);
  return updated;
}

async function addNoteAttachment(projectId, noteId, attachment) {
  const note = await getNote(projectId, noteId);
  if (!note) return null;
  const normalized = {
    id: crypto.randomUUID(),
    type: attachment.type,
    fileId: attachment.fileId,
    fileName: attachment.fileName || null,
    mimeType: attachment.mimeType || null,
    createdAt: new Date().toISOString(),
    backup: attachment.backup || null,
  };
  const attachments = [...note.attachments, normalized];
  return updateNote(projectId, noteId, { attachments });
}

async function removeNoteAttachment(projectId, noteId, attachmentId) {
  const note = await getNote(projectId, noteId);
  if (!note) return null;
  const attachments = note.attachments.filter((entry) => entry.id !== attachmentId);
  return updateNote(projectId, noteId, { attachments });
}

async function appendNoteBackup(projectId, noteId, backup) {
  const note = await getNote(projectId, noteId);
  if (!note) return null;
  const backups = [...note.backups, backup];
  return updateNote(projectId, noteId, { backups });
}

module.exports = {
  NOTES_KEY,
  listNotes,
  getNote,
  createNote,
  updateNote,
  addNoteAttachment,
  removeNoteAttachment,
  appendNoteBackup,
};
