// Deliberately narrow preparation example for the bundled, unquoted synthetic CSV format.
// This is not a general CSV parser or an automatic cleaning feature of the app.
export function prepareDemoRaw(csv, headers, expectedOutcomeUnit) {
  const lines = csv.trimEnd().split(/\r?\n/);
  if (lines.shift() !== 'record_id,exposure,exposure_unit,outcome,outcome_unit')
    throw new Error('Unexpected teaching raw-register header.');
  const seen = new Map();
  const log = [];
  const output = [headers];
  for (const line of lines) {
    const cells = line.split(',');
    if (cells.length !== 5 || cells.some((c) => c.includes('"')))
      throw new Error('This teaching script accepts only its documented unquoted format.');
    const [id, x, xUnit, y, yUnit] = cells;
    if (!id) throw new Error('Missing record ID.');
    if (seen.has(id)) {
      if (seen.get(id) !== line)
        throw new Error(`Conflicting duplicate ${id}; human review required.`);
      log.push(`${id}: removed exact duplicate; first record retained.`);
      continue;
    }
    seen.set(id, line);
    if (!['hours', 'minutes'].includes(xUnit) || ![expectedOutcomeUnit, 'USD'].includes(yUnit))
      throw new Error(`Unknown unit for ${id}.`);
    const convert = (value, divisor) => {
      if (value === '' || value === 'NA') return value;
      if (!Number.isFinite(Number(value))) throw new Error(`Invalid numeric value for ${id}.`);
      return String(Number(value) / divisor);
    };
    const cleanX = convert(x, xUnit === 'minutes' ? 60 : 1);
    if (xUnit === 'minutes') log.push(`${id}: ${x} minutes converted to ${cleanX} hours.`);
    if (yUnit === 'USD' && expectedOutcomeUnit !== 'kUSD')
      throw new Error('Incompatible outcome unit.');
    const cleanY = convert(y, yUnit === 'USD' ? 1000 : 1);
    if (yUnit === 'USD') log.push(`${id}: ${y} USD converted to ${cleanY} kUSD.`);
    output.push(`${cleanX},${cleanY}`);
  }
  return { csv: output.join('\n') + '\n', log };
}

export function demoWorkspace(csv, isBusiness) {
  const [headers, ...rows] = csv.trimEnd().split('\n');
  const unit = isBusiness ? 'kUSD' : 'points';
  const rawRows = rows.map((line, i) => {
    let [x, y] = line.split(',');
    const xUnit = !isBusiness && i === 1 ? 'minutes' : 'hours';
    const yUnit = isBusiness && i === 1 ? 'USD' : unit;
    if (xUnit === 'minutes') x = String(Number(x) * 60);
    if (yUnit === 'USD') y = String(Number(y) * 1000);
    return `${i + 1},${x},${xUnit},${y},${yUnit}`;
  });
  const raw =
    'record_id,exposure,exposure_unit,outcome,outcome_unit\n' +
    [...rawRows, rawRows[1]].join('\n') +
    '\n';
  const prepared = prepareDemoRaw(raw, headers, unit);
  if (prepared.csv !== csv) throw new Error('Preparation did not reproduce the primary dataset.');
  const complete = rows.filter((line) => line.split(',').every((v) => v !== '' && v !== 'NA'));
  const highest = Math.max(...complete.map((line) => Number(line.split(',')[0])));
  const retained = rows.filter(
    (line) => !complete.includes(line) || Number(line.split(',')[0]) !== highest,
  );
  const sensitivity = headers + '\n' + retained.join('\n') + '\n';
  const context = isBusiness
    ? 'region,annual_market_index,reporting_year\nEast,103,2025\nWest,98,2025\nCentral,106,2025\n'
    : 'course,mean_study_hours,assessment_scale\nSeminar,5,100\nLaboratory,7,20\nLecture,4,15\n';
  const script = `// Synthetic tutorial only. Run: node prepare.mjs raw-register.csv primary-rebuilt.csv\nimport { readFile, writeFile } from 'node:fs/promises';\n${prepareDemoRaw.toString()}\nconst [input, output] = process.argv.slice(2);\nif (!input || !output || input === output) throw new Error('Provide distinct input and output paths.');\nconst result = prepareDemoRaw(await readFile(input, 'utf8'), ${JSON.stringify(headers)}, ${JSON.stringify(unit)});\nawait writeFile(output, result.csv, { flag: 'wx' });\nconsole.log(result.log.join('\\n'));\n`;
  return {
    files: [
      {
        name: 'raw-register.csv',
        csv: raw,
        notes:
          'D2: Synthetic raw register with one exact duplicate and a documented mixed-unit record. Prepared outside the app using the bundled script.',
      },
      {
        name: 'context-aggregates.csv',
        csv: context,
        notes:
          'D3: Locally authored synthetic context, not a repository download. Different observational unit; no supported participant linkage. Not included in either regression.',
      },
      {
        name: 'exploratory-subset.csv',
        csv: sensitivity,
        notes:
          'D4: D1 with the highest complete exposure omitted for a post-hoc sensitivity demonstration. Original incomplete records retained; not an error correction or independent sample.',
      },
    ],
    preparation: {
      script,
      log: prepared.log,
      scope:
        'Executed at demo build time. The script handles only the supplied simple unquoted format. It is an external preparation example, not an automated app cleaning operation.',
    },
  };
}
