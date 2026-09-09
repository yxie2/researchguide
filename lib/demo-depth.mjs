// Authored scenarios, not live agent activity or verified catalogue records.
import { stages } from './workflow.mjs';
import { workflowFor, requiresSupervisorReview } from '../public/workflow-flow.js';

const education = [
  {
    complication: 'A broad learning question meets a short deadline',
    prompt:
      'Maya has eight weeks, no approved recruitment route, and a convenient teaching dataset. Her supervisor asks whether she is studying learning, study effort, or performance on one quiz.',
    options: [
      [
        'Promise an intervention study now',
        'That commits to recruitment and causal identification before feasibility and reading are established.',
      ],
      [
        'Save the interest, uncertainties and feasible scope',
        'Maya records study habits as the interest and quiz performance as a possible measure. Reading will determine the bounded question.',
      ],
      [
        'Let the available columns define the entire dissertation',
        'Convenient columns can support a practice analysis but cannot establish a worthwhile dissertation contribution.',
      ],
    ],
    correct: 1,
    decision:
      'The accepted conversation draft is already saved. Maya checks it in “Review your research starting point” and uses Save and continue without another mandatory explanation or review.',
    tasks: [
      'Maya asks the guide to distinguish learning, self-reported effort and measured performance, and records the eight-week constraint.',
      'She checks the accepted summary, retains the open questions and continues to reading without rewriting the draft.',
    ],
    revision: [
      'Direction v1: Prove that studying improves learning.',
      'Direction v2: Explore study habits, measures of learning and feasible access. The initial claim is withdrawn.',
    ],
  },
  {
    complication: 'A persuasive preprint, a duplicate and an inaccessible paper',
    prompt:
      'The simulated reading list contains an observational result, a selection explanation, a preprint on study diaries, its duplicate catalogue entry and an inaccessible abstract. Which items can support an inspected claim?',
    options: [
      [
        'Count every search hit as independent evidence',
        'Duplicate records inflate apparent support, and an abstract does not establish claims about uninspected methods or results.',
      ],
      [
        'Discard every source that complicates the preferred story',
        'Selective reading hides confounding and measurement problems that should shape the question.',
      ],
      [
        'Deduplicate, inspect passages and record uncertainty',
        'Maya retains conflicting evidence, labels the preprint, and leaves the inaccessible item awaiting full text.',
      ],
    ],
    correct: 2,
    decision:
      'The question narrows from improving learning to the association of reported hours with quiz points in the synthetic sample. The reading does not establish a novel gap.',
    tasks: [
      'Try the authored search query: (study time OR study habits) AND (quiz OR learning). The live app offers Crossref, Europe PMC and arXiv; this example performs no search.',
      'Inspect S1–S4 below, retain exact fictional passages, and separate catalogue discovery from evidence. An uploaded PDF would need extraction and passage verification before supporting a claim.',
      'Save the revised question and a synthesis of measurement and confounding concerns. Open the optional claim ledger in Project materials to record limited support and contrary evidence.',
    ],
    revision: [
      'Literature v1: Study time improves learning.',
      'Literature v2: S1 supports an association; S2 raises confounding; S3 questions recall; S4 adds contextual variation.',
    ],
  },
  {
    complication: 'The proposed methods cannot answer the first question',
    prompt:
      'A design-stage check flags causal language and an unmeasured learning construct. No findings exist yet. Maya considers adding a prior-achievement adjustment, but D1 has no such column.',
    options: [
      [
        'Invent a proxy achievement column',
        'An agent cannot reconstruct unobserved achievement from these records. This would fabricate information.',
      ],
      [
        'Bound the analysis and obtain protocol review',
        'Keep an unadjusted teaching model, document omitted achievement and request approval of the revised protocol.',
      ],
      [
        'Wait for a significant result to settle the design',
        'Results cannot retroactively justify an outcome, sampling scheme or causal estimand.',
      ],
    ],
    correct: 1,
    decision:
      'A fictional revise decision is followed by protocol v2 and fictional approval. The check compares question, literature and methods; it does not demand findings. No claim of preregistration is made.',
    tasks: [
      'Specify one student per row, quiz points as outcome, reported hours as predictor, complete cases and the missing confounders. Explain those choices for protocol review.',
      'Run the prospective question–methods check. Reject a suggestion to estimate a causal effect because no identification strategy or appropriate data exist.',
      'Record a revision request, save the bounded protocol, and record approval of its current version before completing data preparation.',
    ],
    revision: [
      'Protocol v1: Causal language and unspecified outcome scale; supervisor requests revision.',
      'Protocol v2: Unadjusted association, 0–15 quiz scale, explicit exclusions and limitations; fictional approval recorded.',
    ],
  },
  {
    complication: 'Duplicate records, mixed units and a tempting public dataset',
    prompt:
      'The bundled raw register repeats student 2 and records that student’s time in minutes. A separate contextual dataset has course averages but no student identifiers. A simulated Dataverse candidate also measures course averages.',
    options: [
      [
        'Append course averages as additional students',
        'That mixes units of analysis and can create ecological bias; there is no valid participant linkage.',
      ],
      [
        'Drop all unusual values and replace blanks with zero',
        'Unusual observations are not automatically errors, and missing measurements are not zeros.',
      ],
      [
        'Preserve raw data, harmonize units and keep context separate',
        'The build deduplicates the repeated ID, converts 120 minutes to 2 hours, and reproduces D1 exactly. Context remains a separate file.',
      ],
    ],
    correct: 2,
    decision:
      'D1 is the harmonized primary extract; D2 preserves the raw register; D3 holds separate contextual aggregates; D4 holds a documented exploratory sensitivity subset. No catalogue candidate is automatically a downloaded or verified dataset.',
    tasks: [
      'Review the simulated public-data candidates, including incompatible units and unclear access. In a real search inspect the landing page, licence and dictionary before downloading.',
      'Keep all four supplied CSVs in the data workspace. Inspect origins, hashes and profiles; use the bundled preparation script to reproduce the primary extract outside the app.',
      'Save duplicate handling, minutes-to-hours conversion, missingness, the reason for keeping aggregates separate and the post-hoc sensitivity deviation.',
    ],
    revision: [
      'Data report v1: Primary extract only.',
      'Data report v2: Raw lineage, contextual file and exploratory subset added. Recheck downstream plan context; preserve any older outputs as history.',
    ],
  },
  {
    complication: 'An attractive slope and an exploratory sensitivity analysis',
    prompt:
      'The primary model is already known to the tutorial author. Maya now asks whether the highest complete study-time observation matters. Should a second run replace the primary result?',
    options: [
      [
        'Report whichever run has the better interval',
        'Selecting the preferred result conceals researcher flexibility and misrepresents the analysis history.',
      ],
      [
        'Run and label a separate exploratory check',
        'R2 omits the highest complete exposure, uses a separately approved plan and retains R1. It tests one sensitivity only, not overall robustness.',
      ],
      [
        'Say the agent verified every regression assumption',
        'The agent cannot establish assumptions from a short conversation or certify a six-case model.',
      ],
    ],
    correct: 1,
    decision:
      'R1 uses {{used}} rows with slope {{slope}} (95% CI {{lower}} to {{upper}}). R2 uses {{sensitivity_used}} rows with slope {{sensitivity_slope}} (95% CI {{sensitivity_lower}} to {{sensitivity_upper}}). Both were actually computed in R.',
    tasks: [
      'Review the D1 variable mapping and exact script, then inspect R1. Review a separate D4 plan and inspect R2, retaining its exploratory label and exclusion rule.',
      'Record both estimates, intervals and counts. Keep residuals and environment files. Multivariable, clustered and qualitative analyses require methods outside the current fixed runner.',
    ],
    revision: [
      'Analysis record v1: Primary R1 retained.',
      'Analysis record v2: Exploratory R2 added with a separate input hash and approval; primary result is not replaced.',
    ],
  },
  {
    complication: 'Agreement between two slopes is not causal validation',
    prompt:
      'Maya’s draft says the sensitivity analysis proves a stable benefit for every student. The qualitative teaching excerpt describes variation in study strategies, and prior achievement remains unmeasured.',
    options: [
      [
        'Treat similar estimates as proof of a universal effect',
        'One subset check cannot eliminate confounding, measurement error or sampling limitations.',
      ],
      [
        'Delete the qualitative disagreement',
        'Different measures and contexts help explain why findings may differ; disagreement belongs in interpretation.',
      ],
      [
        'Bound the claim and retain unresolved explanations',
        'The report distinguishes an observed synthetic association, one exploratory check and unanswered causal questions.',
      ],
    ],
    correct: 2,
    decision:
      'A simulated consistency finding links the overclaim to the noncausal protocol and R1/R2. Maya accepts it, saves a revision and requests a check of the current version. Historical checks remain visible.',
    tasks: [
      'Answer the refined question with R1 and disclose R2 separately; discuss achievement, recall, strategy differences and missingness.',
      'Inspect findings about causality and generalization. Record a reasoned response and rerun after revising the document; an old review is not evidence about the current wording.',
    ],
    revision: [
      'Conclusion v1: Stable causal benefit for all students.',
      'Conclusion v2: A synthetic unadjusted association plus a limited exploratory check; causal and population claims withdrawn.',
    ],
  },
  {
    complication: 'A complete package still needs a bounded final claim',
    prompt:
      'The draft abstract omits the two incomplete rows and presents the sensitivity check as planned. A reviewer asks for transparent exclusions, source status and a reproducible handoff.',
    options: [
      [
        'Export the old approved draft after editing it',
        'An earlier approval does not cover a changed document. Renew the final review for the saved revision.',
      ],
      [
        'Correct the report, renew review and export the full record',
        'Include all datasets, preparation code, both R runs, search decisions, limitations and the revision trail.',
      ],
      [
        'Import the reproduction JSON as a project backup',
        'The reproduction bundle contains data and computation, not the app’s project-backup schema. Use CSV imports for practice or a real project backup for restoration.',
      ],
    ],
    correct: 1,
    decision:
      'The final simulated review covers the revised teaching report. The live app’s Export project offers a report and project backup; Open project, New project and Import project serve different purposes and do not advance a research step.',
    tasks: [
      'Assemble earlier writing and preserve exclusions, fictional-source labels, prior exposure and the exploratory R2 designation.',
      'Check question, protocol, both runs and abstract for agreement; unresolved methodological limits stay in the report.',
      'Record the requested corrections and final review of the saved version. Only the protocol and this final report require supervisor checkpoints.',
      'Download the walkthrough, four datasets, preparation script and two-run reproduction bundle. For live work, export a separate project backup and test import as a new copy.',
    ],
    revision: [
      'Report v1: Exclusions and exploratory status omitted; review requests revision.',
      'Report v2: Corrected abstract, full provenance and both runs retained; fictional final approval.',
    ],
  },
];

const business = [
  {
    complication: 'The sponsor wants ROI before the research question exists',
    prompt:
      'Northstar’s director requests a profitable-training story within one term. Alex has revenue records but no costs, margins or comparison group, and needs to distinguish sponsor priorities from research commitments.',
    options: [
      [
        'Promise a positive ROI conclusion',
        'That precommits to an answer and a business measure the records do not contain.',
      ],
      [
        'Record the interest, stakeholder pressure and missing information',
        'Alex saves employee development as the interest, revenue as a possible outcome, and profitability as an unanswered managerial question.',
      ],
      [
        'Ask the agent to choose a conclusion now',
        'The agent can help structure uncertainties; it cannot replace the researcher’s scientific judgment.',
      ],
    ],
    correct: 1,
    decision:
      'Alex accepts a provisional summary and reviews the already saved starting point. Save and continue carries the scope into reading without a compulsory early supervisor checkpoint.',
    tasks: [
      'Discuss skills, sales performance, sponsor expectations and access constraints with the optional guide.',
      'Check the accepted draft and retain the missing costs and comparison group as open questions before reading.',
    ],
    revision: [
      'Direction v1: Prove training is profitable.',
      'Direction v2: Explore training and performance, with ROI and selection explicitly unresolved.',
    ],
  },
  {
    complication: 'A vendor claim conflicts with selection and transfer mechanisms',
    prompt:
      'A simulated search includes an observational association, manager selection, an unreviewed skills-transfer model, a duplicate preprint and a vendor abstract. Which reading strategy protects the question from sponsor bias?',
    options: [
      [
        'Treat the vendor abstract as verified ROI evidence',
        'Marketing language and an uninspected abstract cannot establish attributable benefits or costs.',
      ],
      [
        'Retain only positive training studies',
        'That would conceal selection and implementation conditions central to the research problem.',
      ],
      [
        'Inspect contradictory mechanisms and track source status',
        'Alex records selection, transfer conditions and measurement differences; duplicate and inaccessible items do not add independent support.',
      ],
    ],
    correct: 2,
    decision:
      'The refined question concerns April training and May booked revenue among fictional representatives. A skill mechanism remains hypothetical and the small simulated search establishes no novel gap.',
    tasks: [
      'Explore the authored query (sales training OR employee development) AND (sales performance OR revenue). Crossref, Europe PMC and arXiv are live options; disciplinary coverage must be assessed.',
      'Inspect S1–S4, keep the preprint status and retain only claims supported by the quoted fictional passages. Uploading a paper and accepting an extracted passage are separate decisions.',
      'Synthesize selection, skills transfer and revenue definitions; use the optional claim ledger for the rejected ROI claim and competing mechanisms.',
    ],
    revision: [
      'Literature v1: Training generates profit.',
      'Literature v2: Revenue association, selection and transfer conditions; profit claim rejected.',
    ],
  },
  {
    complication: 'Transaction counts would inflate the employee sample',
    prompt:
      'Alex is offered transaction rows and regional aggregates. Transactions nest within representatives and territories, while the intended question concerns representatives. Baseline sales and costs are unavailable.',
    options: [
      [
        'Treat each transaction as an independent employee',
        'Repeated transactions do not create independent representatives and could understate uncertainty.',
      ],
      [
        'Keep the representative unit and limit the estimand',
        'Use the bounded unadjusted teaching association; document clustering concerns and defer a causal evaluation to a stronger design.',
      ],
      [
        'Use a simple regression and call it difference-in-differences',
        'A label cannot supply treated and comparison units, pre-period outcomes or identification assumptions.',
      ],
    ],
    correct: 1,
    decision:
      'The prospective design check flags the unit and ROI mismatch, not absent findings. The fictional supervisor requests revision and approves a corrected limited protocol, not a company investment decision.',
    tasks: [
      'Write the unit, April/May timing, kUSD outcome, exclusions and manager selection. Explain why ROI, mediation and causal evaluation are outside scope.',
      'Compare the literature-informed question with proposed methods. Do not ask for findings at the planning stage.',
      'Save protocol v2 after a revision request and record the fictional approval of that version.',
    ],
    revision: [
      'Protocol v1: Transactions treated as representatives; ROI promised.',
      'Protocol v2: One representative per row, booked revenue in kUSD, complete cases, no causal or ROI inference; fictional approval.',
    ],
  },
  {
    complication: 'Dollar units, a duplicated representative and incompatible aggregates',
    prompt:
      'The raw register repeats representative 2, whose revenue is stored in dollars while others use kUSD. The contextual file describes regions, not representatives. A simulated public catalogue result reports annual firm sales.',
    options: [
      [
        'Join regional averages to every employee and call them controls',
        'Without a justified linkage and model, this introduces unsupported information and does not resolve employee selection.',
      ],
      [
        'Interpret 61,000 as kUSD',
        'The dictionary identifies dollars; missing the conversion creates a thousand-fold error.',
      ],
      [
        'Retain raw data and document every transformation',
        'The preparation code deduplicates the repeated ID, converts 61,000 USD to 61 kUSD, reproduces D1, and keeps regional context separate.',
      ],
    ],
    correct: 2,
    decision:
      'Four saved files have distinct roles: harmonized primary data, raw register, contextual aggregates and an exploratory subset. Public candidates remain separate from verified downloaded files and employee-level evidence.',
    tasks: [
      'Assess authored Dataverse-style candidates for unit, year, licence and access; annual firm aggregates do not answer an employee-level monthly question.',
      'Inspect all four files, dictionaries and hashes. The provided preparation script runs outside the app; neither an LLM nor a CSV profile automatically verifies joins or identities.',
      'Record duplicate handling, dollars-to-kUSD conversion, two incomplete records and the decision to keep context separate.',
    ],
    revision: [
      'Data report v1: Prepared primary data only.',
      'Data report v2: Raw lineage, unit correction, context and exploratory subset recorded; downstream plans must use current context.',
    ],
  },
  {
    complication: 'The sponsor prefers a more favorable model',
    prompt:
      'The director asks Alex to remove a high-training representative whose sales look disappointing. Alex can demonstrate a sensitivity check but must not hide the original analysis or imply a data error without evidence.',
    options: [
      [
        'Delete the record and report only the improved story',
        'Outcome-driven exclusion would change the analysis and conceal the sponsor’s influence.',
      ],
      [
        'Keep R1 and disclose a separately approved exploratory R2',
        'The highest complete exposure is omitted only in a labeled sensitivity subset; both datasets and outputs remain available.',
      ],
      [
        'Run many variants and keep the smallest p-value',
        'That introduces unreported selection among analyses and undermines the meaning of the reported uncertainty.',
      ],
    ],
    correct: 1,
    decision:
      'R1 uses {{used}} records: slope {{slope}} kUSD/hour (95% CI {{lower}} to {{upper}}). R2 uses {{sensitivity_used}}: {{sensitivity_slope}} (95% CI {{sensitivity_lower}} to {{sensitivity_upper}}). Both runs remain visible; neither estimates ROI.',
    tasks: [
      'Review the variable mapping, selected dataset, script and separate approval for each run. Inspect counts, coefficients and residuals; preserve both results.',
      'Document sponsor pressure, the post-hoc exclusion and both intervals. A future panel or clustered analysis needs an appropriate external method, not relabeling the fixed simple regression.',
    ],
    revision: [
      'Analysis record v1: Primary R1.',
      'Analysis record v2: Exploratory R2 alongside R1; no evidence that the omitted record was erroneous.',
    ],
  },
  {
    complication: 'An uncertain association is mistaken for a cancellation decision',
    prompt:
      'One reader calls the slope proof of profit, while another calls the zero-crossing primary interval proof the program has no value. The qualitative teaching excerpt describes barriers to transferring training into work.',
    options: [
      [
        'Recommend cancellation because the interval crosses zero',
        'An imprecise association is not an equivalence test or a causal estimate of program value.',
      ],
      [
        'Convert booked revenue directly into ROI',
        'Attributable incremental benefits, costs and margins are missing.',
      ],
      [
        'Explain uncertainty and competing mechanisms',
        'Alex preserves the measured outcome, units, both analyses and implementation explanations, and states what a future evaluation needs.',
      ],
    ],
    correct: 2,
    decision:
      'The simulated consistency review flags causal wording, a revenue/profit mismatch and selective omission of R2. Alex revises the conclusion and requests a new review; methodological uncertainty remains.',
    tasks: [
      'Connect R1, R2 and the conflicting teaching literature without claiming a management decision has been established.',
      'Record responses to the unit, causality and uncertainty findings and check the revised version. A clean check does not supply missing costs or baseline data.',
    ],
    revision: [
      'Conclusion v1: Training creates profit, or has no value.',
      'Conclusion v2: Imprecise synthetic revenue association; no ROI, causal effect or expansion/cancellation recommendation.',
    ],
  },
  {
    complication: 'The executive summary quietly drops the caveats',
    prompt:
      'The academic report discloses missingness and sponsor-requested exploration, but the executive summary omits both. A final review also finds an older draft’s ROI wording in the abstract.',
    options: [
      [
        'Approve only the academic report and leave the summary',
        'Both outputs communicate the study and need to agree on the outcome, uncertainty and limitations.',
      ],
      [
        'Revise both outputs and renew final review',
        'The revised report, executive summary, decisions, four CSVs, preparation code and both runs form the handoff.',
      ],
      [
        'Use a reproduction bundle to overwrite the active project',
        'That bundle is not a project backup. A real backup import creates a separate project; opening a demo should never overwrite active work.',
      ],
    ],
    correct: 1,
    decision:
      'The fictional supervisor reviews the saved final version. The executive summary retains uncertainty and the unresolved investment question. Demo downloads are practice materials, not actual supervisor approval or an importable project backup.',
    tasks: [
      'Assemble a teaching report and executive summary with identical estimates, units and limitations, including the exploratory analysis and sponsor influence.',
      'Check question, design, recorded results, abstract and executive summary together; correct stale ROI wording.',
      'Record revision and final review of the saved package; optional discussions in earlier steps were not mandatory checkpoints.',
      'Export the walkthrough and computation bundle. In the live app use project backup for restoration, Open project to switch, and New project to start a separate study.',
    ],
    revision: [
      'Report v1: Executive summary omits uncertainty and exploration; review requests revision.',
      'Report v2: Academic and executive accounts agree; full provenance retained; fictional final approval.',
    ],
  },
];

export function deepenDemo(source) {
  const result = structuredClone(source);
  const isBusiness = source.id === 'alex-business-study';
  const scenarios = isBusiness ? business : education;
  result.edition = 2;
  result.overview = `${isBusiness ? 'Alex' : 'Maya'} navigates all seven current research steps, with conflicting literature, a revised protocol, multiple datasets, raw-data preparation, two real R runs, selective-reporting pressure and a revised final report. Explore each task and try the decision exercises. Conversations, catalogue examples and reviews are authored simulations; only the bundled preparation and numerical computations actually execute during the build.`;
  result.search = {
    disclosure:
      'Authored catalogue exercise only. No live search, real publication, DOI, repository deposit or access permission is implied.',
    results: [
      {
        id: 'L1',
        label: 'S1 · observational association',
        status: 'Inspected fictional passage; limited support for association.',
      },
      {
        id: 'L2',
        label: 'S2 · selection / confounding',
        status: 'Inspected fictional passage; retained as a competing explanation.',
      },
      {
        id: 'L3',
        label: 'S3 · arXiv-style preprint candidate',
        status: 'Inspected fictional passage; preprint status retained, not assumed peer reviewed.',
      },
      {
        id: 'L4',
        label: 'Duplicate listing of S3',
        status: 'Merged with L3; not another independent study.',
      },
      {
        id: 'L5',
        label: 'Abstract-only candidate',
        status:
          'Full text unavailable in the scenario; awaiting inspection, not used to support full-text claims.',
      },
      {
        id: 'L6',
        label: 'S4 · qualitative counterpoint',
        status:
          'Inspected fictional passage; explains contextual differences, not an effect-size estimate.',
      },
    ],
  };
  result.publicCandidates = [
    {
      title: isBusiness ? 'Annual firm sales aggregates' : 'Annual course performance aggregates',
      decision:
        'Reject for primary analysis: incompatible observational unit and time scale; no participant linkage.',
    },
    {
      title: isBusiness
        ? 'Restricted employee development survey'
        : 'Restricted student learning survey',
      decision:
        'Defer: access and reuse conditions unresolved; no file downloaded or permission inferred.',
    },
    {
      title: isBusiness ? 'Regional business context' : 'Course study context',
      decision:
        'Context only: illustrated by synthetic D3. This file is authored locally, not retrieved from a repository.',
    },
  ];
  const newSources = isBusiness
    ? [
        [
          'Skills transfer model — preprint (fictional)',
          'In this fictional conceptual account, training may develop skills, but opportunities to apply those skills differ between teams. No revenue or profit effect is estimated.',
          'Conceptual preprint; mechanism hypothesis only, not verified peer review or empirical support for ROI.',
        ],
        [
          'Workplace implementation interviews (fictional)',
          'In these invented interviews, representatives described limited manager follow-up and uneven access to promising accounts as barriers to applying training.',
          'Illustrative qualitative counterpoint; no sampling documentation or causal effect estimate.',
        ],
      ]
    : [
        [
          'Study diary measurement — preprint (fictional)',
          'In this invented measurement example, retrospective reports of weekly study time differed from daily diary totals. Neither measure captured the quality of study strategies.',
          'Measurement preprint; no verified peer review and no estimate of a causal learning effect.',
        ],
        [
          'Study strategy interviews (fictional)',
          'In these invented interviews, students described equal study hours spent on different activities, including retrieval practice and rereading. Their circumstances constrained how they studied.',
          'Illustrative qualitative counterpoint; not representative and not a quantitative effect estimate.',
        ],
      ];
  result.stages[1].sources.push(
    ...newSources.map(([title, passage, limitation], i) => ({
      id: `S${i + 3}`,
      title,
      passage,
      limitation,
    })),
  );
  result.stages.forEach((stage, i) => {
    const depth = scenarios[i];
    stage.title = stages[i].title;
    stage.tasks = workflowFor(stage.id).map(([id, title, description], j) => ({
      id,
      title,
      description,
      example: depth.tasks[j],
    }));
    stage.where = stage.tasks.map((t) => t.title).join(' → ');
    stage.checkpoint = requiresSupervisorReview(stage.id);
    stage.depth = depth;
    stage.turns.push(
      [
        isBusiness ? 'Alex · researcher' : 'Maya · researcher',
        `A complication to work through: ${depth.complication}.`,
      ],
      ['Research guide · simulated agent', depth.prompt],
      [isBusiness ? 'Alex · researcher' : 'Maya · researcher', depth.decision],
    );
    stage.artifact += `\n\nExtended decision record:\n${depth.revision.join('\n')}\n${depth.decision}`;
    stage.carry += ` ${depth.revision.at(-1)}`;
  });
  // Replace statements made obsolete by the added exploratory run.
  for (const stage of result.stages) {
    stage.artifact = stage.artifact
      .replace(
        'No comprehensive influence or sensitivity assessment was performed.',
        'One exploratory highest-exposure omission check is provided as R2; no comprehensive influence assessment was performed.',
      )
      .replace(
        'no comprehensive influence, clustering or sensitivity assessment was performed.',
        'one exploratory highest-exposure omission check is provided as R2; no comprehensive influence or clustering assessment was performed.',
      )
      .replace(
        'Exploratory analyses: None.',
        'Exploratory analyses: R2, a post-hoc highest-complete-exposure omission check, retained alongside R1.',
      )
      .replace(
        'Influence and sensitivity analyses require further work.',
        'A later post-hoc sensitivity check is disclosed separately; comprehensive influence analysis still requires further work.',
      )
      .replace(
        'Protocol deviations: None.',
        'Protocol deviations: A later post-hoc sensitivity check is recorded separately; the primary complete-case rule is unchanged.',
      )
      .replace('two teaching excerpts', 'four teaching excerpts');
  }
  result.stages[1].artifact +=
    '\nS3: Preprint mechanism or measurement limits; does not verify a causal effect.\nS4: Qualitative context retained as a counterpoint; does not estimate the regression slope.\nSearch accounting: Six authored records, one duplicate, one awaiting full text, four inspected fictional excerpts. No live search or systematic-review completeness claimed.';
  const comparison =
    '\nExploratory R2: Highest complete exposure omitted after the primary result was known; {{sensitivity_used}} records, slope {{sensitivity_slope}} (model-based 95% CI {{sensitivity_lower}} to {{sensitivity_upper}}). Units match R1. This is not an independent replication, a prespecified test or proof of robustness. Primary R1 remains reported.';
  for (const stage of result.stages.slice(4)) stage.artifact += comparison;
  result.stages[3].artifact +=
    '\nExtended workspace: D2 raw register, D3 separate contextual aggregates and D4 exploratory subset accompany D1. Preparation occurs in the supplied external script, not automatically in the app. Full transformation log and exact files are included in the dataset workspace download.';
  result.stages[6].artifact +=
    '\nExtended package: Four synthetic CSVs and their roles, reproducible preparation script, transformation log, two separately approved R plans and runs, fictional search/screening decisions, and versioned decision records. Both the primary and exploratory result must remain visible.';
  return result;
}
