// Lists the todos through the API Route, which the Site's page shares an origin with.
const response = await fetch('/api', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ data: { op: 'list' } }),
});
const answer = await response.json();
document.getElementById('version').textContent = `API ${answer.version}`;
const list = document.getElementById('todos');
for (const todo of answer.todos ?? []) {
  const item = document.createElement('li');
  item.textContent = todo.done ? `${todo.title} (done)` : todo.title;
  list.append(item);
}
