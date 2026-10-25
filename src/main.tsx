import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Task = { id: string; title: string; done: boolean };
function App() {
  const [tasks, setTasks] = useState<Task[]>(() => JSON.parse(localStorage.getItem('tasks') || '[]'));
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');
  useEffect(() => { localStorage.setItem('tasks', JSON.stringify(tasks)); }, [tasks]);
  const visible = tasks.filter(t => filter === 'All' || (filter === 'Completed' ? t.done : !t.done));
  return <main>
    <h1>Test App</h1><p>A simple React todo app.</p>
    <form onSubmit={event => {
      event.preventDefault();
      const value = title.trim();
      setError(value ? '' : 'Enter a task.');
      if (!value) return;
      setTasks([...tasks, { id: crypto.randomUUID(), title: value, done: false }]);
      setTitle('');
    }}>
      <label htmlFor="task">New task</label>
      <input id="task" maxLength={100} autoComplete="off" value={title} onChange={event => setTitle(event.target.value)} />
      <button>Add task</button><p role="alert">{error}</p>
    </form>
    <label htmlFor="filter">Show tasks</label>
    <select id="filter" value={filter} onChange={event => setFilter(event.target.value)}>
      <option>All</option><option>Active</option><option>Completed</option>
    </select>
    <p role="status">{tasks.filter(t => !t.done).length} tasks remaining</p>
    <ul aria-label="Tasks">{visible.map(task => <li key={task.id}>
      <input type="checkbox" aria-label={`Complete ${task.title}`} checked={task.done}
        onChange={event => setTasks(tasks.map(t => t.id === task.id ? { ...t, done: event.target.checked } : t))} />
      <span style={{ textDecoration: task.done ? 'line-through' : undefined }}>{task.title}</span>
      <button aria-label={`Delete ${task.title}`} onClick={() => setTasks(tasks.filter(t => t.id !== task.id))}>Delete</button>
    </li>)}</ul>
    <button onClick={() => setTasks(tasks.filter(t => !t.done))}>Clear completed</button>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
