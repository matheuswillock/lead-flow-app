# 🎨 Exemplo Prático: Implementando Nova Feature Frontend

> Exemplo completo de implementação de uma feature "Tasks" seguindo arquitetura Lead Flow

## 📋 Estrutura Final

```
app/[supabaseId]/tasks/
├── page.tsx
└── features/
    ├── container/
    │   ├── TasksContainer.tsx
    │   ├── TasksHeader.tsx
    │   ├── TasksDialog.tsx
    │   ├── TaskCard.tsx
    │   └── TasksList.tsx
    ├── context/
    │   ├── TasksTypes.ts
    │   ├── TasksHook.ts
    │   └── TasksContext.tsx
    ├── services/
    │   ├── ITasksService.ts
    │   └── TasksService.ts
    └── hooks/
        └── useTasks.ts (opcional)
```

## 🏗️ Implementação Completa

### 1. TasksTypes.ts - Definições de Tipos

```typescript
'use client';

// Entidades
export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  managerId: string;
  createdAt: string;
  updatedAt: string;
}

// DTOs
export interface CreateTaskDTO {
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
}

export interface UpdateTaskDTO extends Partial<CreateTaskDTO> {}

export interface TasksFilters {
  status?: string;
  priority?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Context Types
export interface ITasksState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  filters: TasksFilters;
  selectedTask: Task | null;
  isDialogOpen: boolean;
}

export interface ITasksActions {
  fetchTasks: () => Promise<void>;
  createTask: (data: CreateTaskDTO) => Promise<void>;
  updateTask: (id: string, data: UpdateTaskDTO) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateFilters: (filters: Partial<TasksFilters>) => void;
  selectTask: (task: Task | null) => void;
  toggleDialog: (open?: boolean) => void;
}

export interface ITasksContext extends ITasksState, ITasksActions {}

export interface ITasksProviderProps {
  children: React.ReactNode;
  initialFilters?: TasksFilters;
}

export type TasksContextType = ITasksContext | null;
```

### 2. TasksHook.ts - Lógica de Negócio

```typescript
'use client';

import { useState, useCallback } from 'react';
import { ITasksState, ITasksActions, TasksFilters, CreateTaskDTO, UpdateTaskDTO } from './TasksTypes';
import { ITasksService } from '../services/ITasksService';

interface UseTasksHookProps {
  supabaseId: string;
  tasksService: ITasksService;
  initialFilters?: TasksFilters;
}

interface UseTasksHookReturn extends ITasksState, ITasksActions {}

export function useTasksHook({ 
  supabaseId, 
  tasksService, 
  initialFilters = {} 
}: UseTasksHookProps): UseTasksHookReturn {
  
  // Estados principais
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TasksFilters>(initialFilters);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Ações
  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await tasksService.getTasks({ ...filters, managerId: supabaseId });
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tasks');
    } finally {
      setIsLoading(false);
    }
  }, [supabaseId, tasksService, filters]);

  const createTask = useCallback(async (data: CreateTaskDTO) => {
    try {
      setError(null);
      const newTask = await tasksService.createTask({ ...data, managerId: supabaseId });
      setTasks(prev => [newTask, ...prev]);
      setIsDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar task');
      throw err;
    }
  }, [supabaseId, tasksService]);

  const updateTask = useCallback(async (id: string, data: UpdateTaskDTO) => {
    try {
      setError(null);
      const updatedTask = await tasksService.updateTask(id, data);
      setTasks(prev => prev.map(task => task.id === id ? updatedTask : task));
      setSelectedTask(null);
      setIsDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar task');
      throw err;
    }
  }, [tasksService]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      setError(null);
      await tasksService.deleteTask(id);
      setTasks(prev => prev.filter(task => task.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir task');
      throw err;
    }
  }, [tasksService]);

  const updateFilters = useCallback((newFilters: Partial<TasksFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const selectTask = useCallback((task: Task | null) => {
    setSelectedTask(task);
  }, []);

  const toggleDialog = useCallback((open?: boolean) => {
    setIsDialogOpen(prev => open !== undefined ? open : !prev);
    if (open === false) {
      setSelectedTask(null);
    }
  }, []);

  return {
    // State
    tasks,
    isLoading,
    error,
    filters,
    selectedTask,
    isDialogOpen,
    
    // Actions
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    updateFilters,
    selectTask,
    toggleDialog
  };
}
```

### 3. TasksContext.tsx - Provider

```typescript
'use client';

import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { TasksContextType, ITasksContext, TasksFilters } from './TasksTypes';
import { useTasksHook } from './TasksHook';
import { tasksService } from '../services/TasksService';

interface ITasksProviderProps {
  children: ReactNode;
  initialFilters?: TasksFilters;
}

// Context
const TasksContext = createContext<TasksContextType>(null);

// Provider
export const TasksProvider: React.FC<ITasksProviderProps> = ({
  children,
  initialFilters = {}
}) => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;

  // Hook com toda a lógica
  const tasksState = useTasksHook({
    supabaseId,
    tasksService,
    initialFilters
  });

  // Buscar tasks quando o componente montar ou filtros mudarem
  useEffect(() => {
    if (supabaseId) {
      tasksState.fetchTasks();
    }
  }, [supabaseId, tasksState.filters]);

  return (
    <TasksContext.Provider value={tasksState}>
      {children}
    </TasksContext.Provider>
  );
};

// Hook para consumir o context
export const useTasksContext = (): ITasksContext => {
  const context = useContext(TasksContext);
  
  if (!context) {
    throw new Error('useTasksContext deve ser usado dentro de TasksProvider');
  }
  
  return context;
};
```

### 4. ITasksService.ts - Interface do Service

```typescript
import { Task, CreateTaskDTO, UpdateTaskDTO, TasksFilters } from '../context/TasksTypes';

export interface ITasksService {
  getTasks(filters: TasksFilters & { managerId: string }): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | null>;
  createTask(data: CreateTaskDTO & { managerId: string }): Promise<Task>;
  updateTask(id: string, data: UpdateTaskDTO): Promise<Task>;
  deleteTask(id: string): Promise<boolean>;
}
```

### 5. TasksService.ts - Implementação do Service

```typescript
import { ITasksService } from './ITasksService';
import { Task, CreateTaskDTO, UpdateTaskDTO, TasksFilters } from '../context/TasksTypes';

export class TasksService implements ITasksService {
  private baseUrl = '/api/v1/tasks';

  async getTasks(filters: TasksFilters & { managerId: string }): Promise<Task[]> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }
    
    return result.result;
  }

  async getTaskById(id: string): Promise<Task | null> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }
    
    return result.result;
  }

  async createTask(data: CreateTaskDTO & { managerId: string }): Promise<Task> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }
    
    return result.result;
  }

  async updateTask(id: string, data: UpdateTaskDTO): Promise<Task> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }
    
    return result.result;
  }

  async deleteTask(id: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }
    
    return true;
  }
}

// Instância singleton
export const tasksService = new TasksService();
```

### 6. TasksContainer.tsx - Container Principal

```typescript
'use client';

import { useTasksContext } from '../context/TasksContext';
import { TasksHeader } from './TasksHeader';
import { TasksList } from './TasksList';
import { TasksDialog } from './TasksDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function TasksContainer() {
  const { 
    tasks, 
    isLoading, 
    error, 
    fetchTasks,
    toggleDialog 
  } = useTasksContext();

  if (isLoading && tasks.length === 0) {
    return <TasksSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchTasks}
          >
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TasksHeader onAdd={() => toggleDialog(true)} />
      
      <TasksList 
        tasks={tasks} 
        isLoading={isLoading}
      />
      
      <TasksDialog />
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((index) => (
          <Skeleton key={index} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}
```

### 7. page.tsx - Página Principal

```typescript
import { TasksProvider } from './features/context/TasksContext';
import { TasksContainer } from './features/container/TasksContainer';

export default function TasksPage() {
  return (
    <TasksProvider initialFilters={{ status: 'all' }}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">
            Tarefas
          </h1>
          <div className="text-sm text-gray-500">
            Gerencie suas tarefas e atividades
          </div>
        </div>

        <TasksContainer />
      </div>
    </TasksProvider>
  );
}
```

## ✅ Checklist de Implementação

### Context SOLID
- [x] TasksTypes.ts com interfaces separadas
- [x] TasksHook.ts com lógica de negócio e useCallback
- [x] TasksContext.tsx com Provider e useParams
- [x] Hook consumidor useTasksContext

### Service Pattern
- [x] Interface ITasksService
- [x] Implementação TasksService
- [x] Tratamento de Output pattern
- [x] Instância singleton

### Container Components
- [x] TasksContainer principal
- [x] Estados loading com skeleton
- [x] Error handling com retry
- [x] Integração com Context

### Page Setup
- [x] Provider no nível da página
- [x] Layout consistente
- [x] Título e descrição

## 🚀 Próximos Passos

1. Implementar TasksHeader, TasksList, TasksDialog
2. Criar API backend (UseCase + Routes)
3. Adicionar testes unitários
4. Documentar endpoints
5. Adicionar ao Postman collection

---

📚 **Referências Utilizadas:**
- Dashboard Context (SOLID pattern)
- Board Container (Component patterns)
- Manager Users (Service patterns)