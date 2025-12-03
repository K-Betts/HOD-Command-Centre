import { useUserCollection } from './shared/useUserCollection';

export function useProjects(user) {
  const {
    data: projects,
    add,
    update,
    remove,
    loading,
    error,
  } = useUserCollection(user, ['projects'], {
    filterByYear: true,
  });

  const addProject = async (project) => {
    if (!user) return;
    const payload = {
      ...project,
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
    await update(id, updates);
  };

  const deleteProject = async (id) => {
    if (!id) return;
    await remove(id);
  };

  return { projects, addProject, updateProject, deleteProject, loading, error };
}
