import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { KanbanBoard } from './components/KanbanBoard';
import { DAGVisualizer } from './components/DAGVisualizer';
import { AgentMonitor } from './components/AgentMonitor';
import { ProvidersTab } from './components/ProvidersTab';
import { TaskDetailModal } from './components/TaskDetailModal';
import { NewTaskModal } from './components/NewTaskModal';
import { CodeEditorTab } from './components/CodeEditorTab';
import { NewProjectModal } from './components/NewProjectModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'kanban' | 'dag' | 'agents' | 'providers' | 'code'>('kanban');
  const [projects, setProjects] = useState<any[]>([]);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  // Fetch initial metadata
  const fetchData = async () => {
    try {
      // Projects
      const projRes = await fetch('/api/projects');
      const projData = await projRes.json();
      setProjects(projData);

      let activeProj = currentProject;
      if (!activeProj && projData.length > 0) {
        activeProj = projData[0];
        setCurrentProject(activeProj);
      }

      if (activeProj) {
        const tasksRes = await fetch(`/api/projects/${activeProj.id}/tasks`);
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
        setDependencies(tasksData.dependencies || []);
      }

      // Roles
      const rolesRes = await fetch('/api/roles');
      const rolesData = await rolesRes.json();
      setRoles(rolesData);

      // Providers
      const provRes = await fetch('/api/providers');
      const provData = await provRes.json();
      setProviders(provData);
    } catch (err) {
      console.error('Error fetching DevOS data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Subscribe to SSE Live Events
  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setEvents((prev) => [parsed, ...prev.slice(0, 150)]);

        // Refresh tasks if state changed
        if (parsed.type === 'finished' || parsed.type === 'started') {
          if (currentProject) {
            fetch(`/api/projects/${currentProject.id}/tasks`)
              .then((r) => r.json())
              .then((d) => {
                setTasks(d.tasks || []);
                setDependencies(d.dependencies || []);
              });
          }
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [currentProject]);

  const handleStartTask = async (taskId: string, providerId: string = 'gemini') => {
    try {
      await fetch(`/api/tasks/${taskId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });
      fetchData();
    } catch (err) {
      console.error('Failed to start task:', err);
    }
  };

  const handleMergeTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/merge`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert(`Merge blocked: ${data.error}`);
      }
      fetchData();
    } catch (err) {
      console.error('Failed to merge task:', err);
    }
  };

  const handleCreateTask = async (taskData: any) => {
    if (!currentProject) return;
    try {
      await fetch(`/api/projects/${currentProject.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      fetchData();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleCreateProject = async (projectData: any) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      const data = await res.json();
      if (data.id) {
        setProjects((prev) => [...prev, data]);
        setCurrentProject(data);
        fetchData();
      } else if (data.error) {
        alert(`Could not open project: ${data.error}`);
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  useEffect(() => {
    if ((window as any).rixmeshDesktop) {
      (window as any).rixmeshDesktop.onSelectedProjectPath((folderPath: string) => {
        const name = folderPath.split('/').pop() || 'Workspace';
        handleCreateProject({ name, rootPath: folderPath, stack: 'typescript' });
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-100 flex flex-col font-sans">
      <Header
        currentProject={currentProject}
        projects={projects}
        onSelectProject={(id: string) => {
          const p = projects.find((x) => x.id === id);
          setCurrentProject(p);
        }}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewTask={() => setIsNewTaskOpen(true)}
        onNewProject={() => setIsNewProjectOpen(true)}
        onRefresh={fetchData}
      />

      <main className="flex-1 overflow-x-hidden">
        {activeTab === 'kanban' && (
          <KanbanBoard
            tasks={tasks}
            onSelectTask={setSelectedTask}
            onStartTask={handleStartTask}
            onMergeTask={handleMergeTask}
          />
        )}

        {activeTab === 'dag' && (
          <DAGVisualizer
            tasks={tasks}
            dependencies={dependencies}
            onSelectTask={setSelectedTask}
          />
        )}

        {activeTab === 'agents' && <AgentMonitor roles={roles} />}

        {activeTab === 'providers' && <ProvidersTab providers={providers} />}

        {activeTab === 'code' && <CodeEditorTab currentProject={currentProject} tasks={tasks} />}
      </main>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          events={events}
          onClose={() => setSelectedTask(null)}
          onStartTask={handleStartTask}
          onMergeTask={handleMergeTask}
        />
      )}

      {/* New Task Modal */}
      {isNewTaskOpen && (
        <NewTaskModal
          roles={roles}
          existingTasks={tasks}
          onClose={() => setIsNewTaskOpen(false)}
          onCreateTask={handleCreateTask}
        />
      )}

      {/* New Project Modal */}
      {isNewProjectOpen && (
        <NewProjectModal
          isOpen={isNewProjectOpen}
          onClose={() => setIsNewProjectOpen(false)}
          onCreateProject={handleCreateProject}
        />
      )}
    </div>
  );
}
