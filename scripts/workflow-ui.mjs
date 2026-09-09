// Navigate actual task headings/materials in browser smoke tests.
export async function openTask(page, id) {
  const back = page.getByRole('button', { name: 'Back to research workflow', exact: true });
  if (await back.isVisible()) await back.click();
  await page.locator('.workflow-sequence').waitFor();
  const task = page.locator(`#task-${id} .workflow-task-heading button`);
  if (await task.count()) {
    await task.click();
    return;
  }
  const materials = page.locator('.workflow-materials');
  if (!(await materials.getAttribute('open')) && (await materials.getAttribute('open')) !== '')
    await materials.locator('summary').click();
  const labels = {
    sources: 'Source library',
    claims: 'Literature claim ledger',
    execution: 'Datasets and recorded analyses',
    discovery: 'Public dataset searches',
    consistency: 'Cross-step review records',
    activity: 'Project history',
  };
  await materials.getByRole('button', { name: labels[id], exact: true }).click();
}
