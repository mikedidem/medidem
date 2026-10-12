(function () {
  'use strict';
  const panel = document.getElementById('groundwater-explorer');
  if (!panel) return;
  const source = document.getElementById('groundwater-data');
  let results;
  try { results = JSON.parse(source.textContent); } catch (_) { return; }
  const benchmark = document.getElementById('benchmark-select');
  const model = document.getElementById('model-select');
  const set = (id, value) => { document.getElementById(id).textContent = value; };
  function render() {
    const rows = results.filter(row => row.benchmark === benchmark.value);
    const selected = rows.find(row => row.model === model.value);
    if (!selected) return;
    set('result-r2', selected.r2.toFixed(5));
    set('result-rmse', 'RMSE ' + selected.rmse.toFixed(4) + ' m');
    set('result-residual', selected.residual + '×');
    set('result-mass', selected.mass + '%');
    const interpretation = selected.model === 'PINN'
      ? 'high predictive accuracy with ' + selected.mass + '% mass-balance error. A residual below 1 measures agreement with the diagnostic operator; it does not establish superiority to MODFLOW.'
      : 'R² exceeds 0.999, but the PDE residual is ' + selected.residual + '× the numerical baseline and mass-balance error is ' + selected.mass + '% of well extraction.';
    set('result-note', selected.benchmark + ' / ' + selected.model + ': ' + interpretation);
    panel.querySelectorAll('.residual-row').forEach(element => {
      const row = rows.find(item => item.model === element.dataset.model);
      element.dataset.selected = String(row.model === selected.model);
      element.querySelector('.residual-bar').style.width = ((Math.log10(row.residual) + 1) / 4 * 100) + '%';
      element.querySelector('.residual-value').textContent = row.residual + '×';
    });
    document.getElementById('residual-plot').setAttribute('aria-label', benchmark.value + ' residual ratios: ' + rows.map(row => row.model + ' ' + row.residual).join(', ') + '. MODFLOW reference is 1.');
  }
  benchmark.addEventListener('change', render);
  model.addEventListener('change', render);
  render();
  panel.classList.add('is-ready');
})();