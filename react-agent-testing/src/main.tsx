import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Task = { id: string; title: string; done: boolean };
const broken = new URLSearchParams(location.search).get('fault') === 'completion';
function App() {
  const [tasks, setTasks] = useState<Task[]>(() => JSON.parse(localStorage.getItem('fieldnotes-tasks') || '[]'));
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');
  useEffect(() => { localStorage.setItem('fieldnotes-tasks', JSON.stringify(tasks)); }, [tasks]);
  const remaining = tasks.filter(task => !task.done).length;
  const visible = tasks.filter(task => filter === 'All' || (filter === 'Completed' ? task.done : !task.done));
  return <main>
    <header><span className="brand">FIELDNOTES</span><span className="pill">React + Codex</span></header>
    <section className="intro"><p className="eyebrow">A SMALL APP. A REAL BROWSER.</p><h1>Make room for<br/>what matters.</h1><p>Your daily list, with a little less noise.</p></section>
    <section className="card" aria-label="Todo workspace">
      <div className="card-title"><h2>Today’s tasks</h2><span role="status">{remaining} {remaining === 1 ? 'task' : 'tasks'} remaining</span></div>
      <form onSubmit={event => {
        event.preventDefault();
        const value = title.trim();
        if (!value) { setError('Enter a task.'); return; }
        setTasks([...tasks, { id: crypto.randomUUID(), title: value, done: false }]);
        setTitle(''); setError('');
      }}><label htmlFor="new-task">New task</label><div className="add-row"><input id="new-task" placeholder="What’s on your mind?" maxLength={100} value={title} onChange={event => setTitle(event.target.value)}/><button className="primary">Add task</button></div><p role="alert" className="error">{error}</p></form>
      <div className="toolbar"><label htmlFor="filter">Show tasks</label><select id="filter" value={filter} onChange={event => setFilter(event.target.value)}><option>All</option><option>Active</option><option>Completed</option></select></div>
      <ul aria-label="Tasks">{visible.map(task => <li key={task.id} aria-label={task.title}>
        <label className="task"><input type="checkbox" aria-label={`Complete ${task.title}`} checked={task.done} onChange={event => { if (!broken) setTasks(tasks.map(t => t.id === task.id ? { ...t, done: event.target.checked } : t)); }}/><span className={task.done ? 'done' : ''}>{task.title}</span></label>
        <button className="delete" aria-label={`Delete ${task.title}`} onClick={() => setTasks(tasks.filter(t => t.id !== task.id))}>Delete</button>
      </li>)}</ul>
      {visible.length === 0 && <p className="empty">A little breathing room. Add a task to get started.</p>}
      <footer><span>Saved in this browser</span><button onClick={() => setTasks(tasks.filter(t => !t.done))}>Clear completed</button></footer>
    </section>
    <p className="caption">The test agent sees this interface and follows your checklist.</p>
    {broken && <p className="fault" role="note">Demo fault enabled: completion is broken.</p>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
