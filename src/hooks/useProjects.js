import { useUserCollection } from './shared/useUserCollection';

const statusMap = {
  ACTIVE: 'ACTIVE',
  IDEA: 'IDEA',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
  'NOT STARTED': 'ACTIVE',
  'IN FLIGHT': 'ACTIVE',
  BLOCKED: 'ACTIVE',
  COMPLETE: 'COMPLETED',
  DONE: 'COMPLETED',
};

function normalizeProjectStatus(status) {
  const key = (status || '').toString().trim().toUpperCase();
  return statusMap[key] || 'ACTIVE';
}

export function useProjects(user) {
  const {
    data: projectDocs,
    add,
    update,
    remove,
    loading,
    error,
  } = useUserCollection(user, ['projects'], {
    filterByYear: true,
  });

  const projects = (projectDocs || []).map((p) => ({
    ...p,
    status: normalizeProjectStatus(p.status),
  }));

  const addProject = async (project) => {
    if (!user) return;
    const payload = {
      ...project,
      status: normalizeProjectStatus(project?.status),
      strategicWhy: project?.strategicWhy || '',
      whyVerdict: project?.whyVerdict || '',
      whyScore: project?.whyScore ?? 0,
      whyCoachNote: project?.whyCoachNote || '',
      whyRewrite: project?.whyRewrite || '',
      whyHeadline: project?.whyHeadline || '',
    };
    await add(payload);
  };

  const updateProject = async (id, updates) => {
    if (!id) return;
    const nextUpdates = { ...updates };
    if (updates?.status) {
      nextUpdates.status = normalizeProjectStatus(updates.status);
    }
    await update(id, nextUpdates);
  };

  const deleteProject = async (id) => {
    if (!id) return;
    await remove(id);
  };

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const ideaProjects = projects.filter((p) => p.status === 'IDEA');
  const completedProjects = projects.filter((p) => p.status === 'COMPLETED');

  return {
    projects,
    activeProjects,
    ideaProjects,
    completedProjects,
    addProject,
    updateProject,
    deleteProject,
    loading,
    error,
  };
}
