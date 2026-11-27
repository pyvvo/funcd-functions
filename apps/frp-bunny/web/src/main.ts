import './style.css';

// The hello Function answers at /api on the page's own host, so the page shares an origin with it.
async function hello(): Promise<string> {
  try {
    const response = await fetch('/api');
    const text = (await response.text()).trim();
    return response.ok ? text : `hello answered ${response.status}: ${text}`;
  } catch (error) {
    return `hello did not answer: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const answer = document.getElementById('answer');
if (answer) {
  answer.textContent = await hello();
}
