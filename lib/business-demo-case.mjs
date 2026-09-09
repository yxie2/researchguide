// Authored teaching simulation. All people, sources and observations are fictional.
export const businessCSV =
  'training_hours,next_month_sales_kusd\n1,44\n2,61\n3,49\n4,67\n5,48\n6,65\n7,53\n8,72\n9,55\n10,69\n11,51\n12,64\n13,NA\n,60\n';
export const businessCase = {
  id: 'alex-business-study',
  researcher: 'Alex',
  title: 'Is employee training associated with higher sales?',
  subtitle:
    'Follow Alex Morgan, a fictional management PhD student, studying sales training at the invented company Northstar Office Supply.',
  overview:
    'Alex starts with a practical interest, reads teaching excerpts to clarify concepts and refine a question, plans a study, prepares synthetic data, reviews an R analysis, interprets its limits and assembles a report. The walkthrough shows a suggested route; real research involves revisiting earlier decisions.',
  datasetName: 'synthetic-training-sales.csv',
  rationale:
    'Estimate the unadjusted association between training hours and next-month sales revenue in synthetic employee records. Use complete cases; unmeasured territory opportunity and manager selection preclude a causal or ROI interpretation.',
  disclosure:
    'Teaching simulation: all people, companies, sources, conversations, reviews and observations are invented. The bundled numbers were computed by the app’s real R runner on synthetic data. Opening this case makes no AI calls and runs no analysis.',
  stages: [
    {
      id: 'question',
      title: 'Explore a research interest',
      where:
        'Discuss this step with your guide → Write and explain your decisions → Supervisor checkpoint',
      input:
        'Northstar’s fictional sales director asks Alex whether a training program pays for itself. The available teaching data contain training hours and sales revenue, but no training costs or margins.',
      turns: [
        [
          'Alex · researcher',
          'The sales director wants me to prove the training program increases profit. I have training hours and next-month sales for 14 fictional representatives.',
        ],
        [
          'Methods mentor · simulated agent',
          'Let’s begin with the problem and why it matters. We do not need a final research question yet. What interests you, and what do you need to learn from existing research?',
        ],
        [
          'Alex · researcher',
          'I’m interested in whether training helps sales teams. A possible teaching dataset has training hours and sales revenue but no costs or margins. Managers chose participation, so I need to read about selection.',
        ],
        [
          'Methods mentor · simulated agent',
          'Training, employee skills and business performance give us a preliminary direction. In the literature review, examine mechanisms, how performance is measured, and who gets selected for training before settling on a question.',
        ],
        [
          'Alex · researcher',
          'I accept an initial research direction, not a final question. I will read about training, employee selection and sales measures, then refine an answerable question. I still need to justify the scope and contribution.',
        ],
      ],
      artifact:
        'Initial research direction: Employee training and business performance at a fictional sales organization.\nMotivation: Understand what a training program might contribute and what an evaluation would need to measure.\nTentative interest: Whether training participation relates to sales performance.\nReading priorities: Key concepts, possible mechanisms, outcome definitions, selection and alternative explanations.\nPossible access: Synthetic records are available for the tutorial; a real project would need access and permissions.\nOpen decisions: The refined question, scope, literature contribution and design will follow reading. No novel gap or causal conclusion is claimed.',
      understanding:
        'This direction is a starting point. The literature may change my concepts, scope and question; supervisor feedback here does not freeze them.',
      review:
        'Fictional supervisor: The initial direction is suitable for exploratory reading. A final question, confirmed dataset and research gap are not required at this checkpoint.',
      carry:
        'Carry the motivation and open questions into the literature review. Return to this direction if the reading changes the scope.',
      challenge: {
        question: 'What should this first step establish?',
        choices: [
          'A final question and a proven research gap before reading',
          'An initial direction and the questions the literature review should explore',
        ],
        correct: 1,
        feedback:
          'Agree a useful direction first. Reading then helps refine the question and assess whether a contribution is defensible.',
      },
    },
    {
      id: 'evidence',
      title: 'Review literature and refine the question',
      where:
        'Inspect sources and save passages → Check claims against source passages → Write and explain your decisions',
      input:
        'The initial direction is employee training and business performance. Reading helps define concepts, examine explanations and refine the question; this is existing literature, not results from the new study.',
      turns: [
        [
          'Alex · researcher',
          'Training should improve selling skills. Can I use that theory as evidence that this program increased revenue?',
        ],
        [
          'Evidence mentor · simulated agent',
          'A plausible mechanism motivates a hypothesis; it does not verify an effect. Inspect designs and alternative explanations in the sources.',
        ],
        [
          'Alex · researcher',
          'Teaching source S1 describes higher sales among employees who attended more training. S2 describes managers selecting employees with stronger sales pipelines for training. These are invented excerpts for this exercise.',
        ],
        [
          'Evidence checker · simulated agent',
          'S1 supports only its stated observational comparison. S2 shows why pipeline opportunity could explain both training attendance and future sales. Neither excerpt establishes this program’s impact.',
        ],
        [
          'Alex · researcher',
          'I reject the claim that these excerpts prove a return on investment. I record skill development as a hypothesis and selection as a rival explanation. For a real dissertation I would retrieve and verify actual studies.',
        ],
        [
          'Alex · researcher',
          'After considering those concepts and limitations, I refine my question: Among the 14 fictional full-time sales representatives at Northstar, how are April training hours associated with May booked sales revenue? This tiny synthetic exercise illustrates methods, not a verified new contribution to the literature.',
        ],
      ],
      sources: [
        {
          id: 'S1',
          title: 'Teaching excerpt A — training and revenue (fictional)',
          passage:
            'In this fictional salesforce comparison, employees attending more training recorded higher subsequent sales revenue. Participation was voluntary and no baseline sales adjustment was made.',
          limitation:
            'Unadjusted observational comparison; cannot separate training from pre-existing differences.',
        },
        {
          id: 'S2',
          title: 'Teaching excerpt B — opportunity and selection (fictional)',
          passage:
            'In this fictional organization, managers offered additional training to representatives with stronger prospective customer pipelines. Pipeline opportunity also predicted later booked sales.',
          limitation: 'Illustrates a confounding pathway; not a real empirical publication.',
        },
      ],
      artifact:
        'Real-search plan: Search suitable management and business databases for (sales training OR employee development) AND (sales revenue OR sales performance); record dates, exact queries, inclusion decisions and inspected passages. No real search was run here.\nS1: Fictional association, with voluntary attendance and no baseline adjustment.\nS2: Fictional selection pathway: pipeline opportunity → training attendance and later sales.\nClaim C1: S1 reports an observational training–revenue association. Accept only this narrow reading.\nRejected claim: Training has a proven positive ROI.\nHypothesized mechanism: Training may improve selling skills; skills are unmeasured here.\nEvidence gap: This tutorial establishes no novel literature gap or verified empirical consensus.\nConceptual framing: Skill development is a possible mechanism; employee selection and territory opportunity are rival explanations. Revenue and profit are distinct concepts.\nRefined research question: Among the 14 fictional full-time sales representatives at Northstar, how are April training hours associated with May booked sales revenue?\nObjective: Describe an unadjusted association with uncertainty, without making a causal claim.\nContribution: A worked teaching example only; no verified literature gap or empirical novelty.\nHypotheses: No confirmatory hypothesis test or preregistration is claimed.\nRefinement: Narrowed a broad practical interest to measured variables in one synthetic sample.',
      understanding:
        'Reading changed a broad interest into a bounded question by clarifying concepts, measurements and alternative explanations. Real work would need verified literature and a defensible contribution.',
      review:
        'Fictional supervisor: Preserve the selection explanation in the protocol. Real scholarship requires authentic sources, critical synthesis and a defensible contribution. The checkpoint now considers the explicit refined question, concepts and feasibility; it does not certify a novel gap from invented sources.',
      carry:
        'The explicit refined question and conceptual limitations now guide the study protocol. If further reading changes them, revise this step and renew affected downstream reviews.',
      challenge: {
        question: 'Which outcome can this dataset actually measure?',
        choices: ['Return on the training investment', 'Next-month booked sales revenue'],
        correct: 1,
        feedback:
          'Booked sales are recorded. ROI additionally needs attributable benefits and appropriate costs; revenue alone does not establish either.',
      },
    },
    {
      id: 'design',
      title: 'Plan the study and methods',
      where:
        'Discuss this step with your guide → Write and explain your decisions → Supervisor checkpoint',
      input:
        'The question is about representatives, not monthly firm totals. The evidence map identifies selection and territory opportunity as unmeasured confounders.',
      turns: [
        [
          'Alex · researcher',
          'Could I treat every transaction as an independent employee observation to get a bigger sample?',
        ],
        [
          'Methods mentor · simulated agent',
          'No. Your current unit is one representative. Repeated transactions from the same person are not independent representatives, and the CSV contains only monthly totals.',
        ],
        [
          'Alex · researcher',
          'I will regress May revenue in kUSD on April training hours. I will use records with both fields, report exclusions and avoid trying multiple models to find significance.',
        ],
        [
          'Methods mentor · simulated agent',
          'Record assumptions and what this simple model omits. Earlier training does not eliminate confounding. Shared territories or teams could violate independence, and baseline sales are unavailable.',
        ],
        [
          'Alex · researcher',
          'I accept a limited descriptive model. A credible program evaluation would need a stronger design and additional measures, beyond this exercise. The tutorial was authored with its data and results known, so it is not a preregistration.',
        ],
      ],
      artifact:
        'Design: Observational secondary analysis of constructed employee records.\nUnit: One fictional representative; training measured in April and revenue in May.\nModel: next_month_sales_kusd ~ training_hours. Primary quantity: Unadjusted slope, kUSD per training hour, with a model-based 95% interval.\nMissingness: Complete cases on both fields; no zero replacement or imputation.\nAssumptions and checks: Inspect fitted values and residuals for curvature, unequal spread and unusual observations. Independent errors are assumed, not established; teams and territories are unmeasured.\nOmitted variables: Baseline sales, tenure, pipeline quality, territory opportunity, account mix and manager selection.\nScope: No adjustment, causal identification, mediation analysis or ROI calculation.\nPrior exposure: Authored teaching dataset with known outputs; not preregistered research.\nReal-world preparation: Agree access and appropriate employee-data handling with the institution and company before collecting real records.',
      understanding:
        'Time order makes a hypothesis plausible but does not remove selection. Changing the unit to inflate the sample would give misleading precision.',
      review:
        'Fictional supervisor: Approve the bounded teaching protocol, with independence and omitted-variable limitations retained. It is insufficient for a causal program evaluation.',
      carry:
        'One row per representative, two selected variables, complete-case exclusions and no ROI claim govern data inspection and execution approval.',
    },
    {
      id: 'data',
      title: 'Obtain and prepare the data',
      where:
        'Data / Analysis tasks → Import a permitted CSV dataset → Write and explain your decisions',
      input:
        'The protocol requires training hours and subsequent revenue in kUSD, one row per representative. In this example the data are already available synthetic records; new data collection would take place outside the app after the relevant permissions and protocol decisions.',
      turns: [
        [
          'Alex · researcher',
          'The spreadsheet says sales = 44. Is that 44 dollars? Also, can I fill missing revenue with zero?',
        ],
        [
          'Data mentor · simulated agent',
          'Read the dictionary before interpreting numbers. Here 44 means 44 thousand US dollars of booked revenue. A missing value does not mean zero sales.',
        ],
        [
          'Alex · researcher',
          'The 14 synthetic rows have one missing May revenue and one missing training-hours value on different rows. There are 12 complete cases. Recorded training ranges from 1 to 13 hours and revenue from 44 to 72 kUSD.',
        ],
        [
          'Data mentor · simulated agent',
          'Preserve the original file, missing cells and hash. Document whether returns, cancellations, currencies and booking dates have consistent definitions; a numeric profile cannot answer those questions by itself.',
        ],
        [
          'Alex · researcher',
          'The teaching dictionary defines all values as May booked revenue in kUSD, with no real transactions behind them. I keep the missing cells, report two exclusions and do not claim to have audited real company records.',
        ],
      ],
      artifact:
        'D1: synthetic-training-sales.csv; 14 author-created rows, two numeric columns.\nDictionary: training_hours = April attendance hours; next_month_sales_kusd = May booked revenue, thousands of US dollars. Revenue is not profit or cash receipts.\nObserved ranges: Training 1–13 hours; revenue 44–72 kUSD.\nMissingness: Row 13 lacks revenue; row 14 lacks training hours. Twelve complete records; two excluded by the planned rule. Missingness mechanism unknown.\nUnits and identity: Common currency and month by construction; each row represents a distinct fictional employee.\nProvenance: Original CSV and SHA-256 retained in the reproduction bundle. No real employee identifiers or commercial records.\nCleaning and deviations: No transformations, imputation or protocol deviations. A real study must inspect the source-system definitions and any corrections separately.',
      understanding:
        'A coefficient expressed in thousands of dollars cannot be reported as dollars. Synthetic consistency of units does not imply that real operational data would be clean.',
      review:
        'Fictional supervisor: The data report matches the planned sample and units. Keep uncertainty about missingness and record definitions visible.',
      carry:
        'The selected input uses twelve complete employee records; the unit kUSD must remain consistent in outputs, claims and the report.',
      challenge: {
        question: 'What does a recorded revenue value of 44 mean here?',
        choices: ['44 US dollars of profit', '44,000 US dollars of booked revenue'],
        correct: 1,
        feedback:
          'The dictionary defines kUSD of booked revenue. Both the scale and the distinction from profit matter.',
      },
    },
    {
      id: 'analysis',
      title: 'Run the approved model and retain uncertainty',
      where: 'Data / Analysis tasks → Propose a plan → Review script → Approve → Run',
      input:
        'The saved protocol selects simple regression on complete cases, with revenue as the outcome and hours as the predictor.',
      turns: [
        ['Alex · researcher', 'Please propose the analysis that matches the protocol.'],
        [
          'Analysis mentor · simulated agent',
          'Use the fixed simple linear regression template: outcome next_month_sales_kusd and predictor training_hours. Use complete cases. No baseline or territory adjustment can be claimed from these two columns.',
        ],
        [
          'Alex · researcher',
          'I check the mappings, kUSD units, omissions and exact R script. I approve this plan for the synthetic data and execute it.',
        ],
        [
          'Local R runner · recorded computation',
          'The actual R outputs use {{used}} of {{total}} rows, excluding {{excluded}}. The estimated slope is {{slope}} kUSD per training hour, with a model-based 95% interval of {{lower}} to {{upper}}.',
        ],
        [
          'Alex · researcher',
          'The interval includes zero. I will not search for a different model just to obtain a positive finding. I will inspect the residual output and retain the uncertainty in the report.',
        ],
        [
          'Analysis mentor · simulated agent',
          'An interval containing zero is not proof of no association. The model is imprecise, and its interval does not address confounding, measurement problems or selection. Keep the input, exact script and session information.',
        ],
      ],
      artifact:
        'Execution R1: Actual local R template applied to synthetic employee records.\nModel: next_month_sales_kusd ~ training_hours. {{used}} complete cases from {{total}} records, {{excluded}} excluded.\nSlope: {{slope}} kUSD/hour; model-based 95% CI {{lower}} to {{upper}}. Intercept: {{intercept}} kUSD.\nThe interval crosses zero; this example does not establish a precisely estimated positive association or demonstrate no association.\nDiagnostics: Exact fitted values and residuals are in diagnostics.csv. The wide dispersion calls for inspection; no comprehensive influence, clustering or sensitivity assessment was performed.\nReproduction: Save run.inputCsv as input.csv and run.script as analysis.R, then run Rscript analysis.R in a clean directory. Retain session.txt and all outputs.\nExploratory analyses: None. No model switching to obtain significance.\nLimitations: Small constructed sample, complete-case selection, unmeasured confounding and unverified assumptions.',
      understanding:
        'R computes the numbers; the agent does not manufacture them. A statistically uncertain association must remain uncertain in the business discussion.',
      review:
        'Fictional supervisor: Accept this reproducible teaching run with its uncertainty. It cannot establish a training effect, a profitable investment or lack of any possible benefit.',
      carry:
        'The exact slope, interval, sample size and kUSD scale constrain interpretation. The uncertainty must survive any executive summary.',
    },
    {
      id: 'interpretation',
      title: 'Interpret findings in context',
      where: 'Write and explain your decisions → Consistency review → Researcher response',
      input:
        'R1 provides an imprecise unadjusted association in kUSD. The protocol explicitly excludes causal and ROI claims.',
      turns: [
        [
          'Alex · researcher',
          'My executive summary says: Every training hour creates {{slope}} dollars of profit, so the company should expand the program.',
        ],
        [
          'Consistency reviewer · simulated agent',
          'Three mismatches: the outcome is revenue in thousands of dollars, not dollars of profit; “creates” implies a causal effect; and the 95% interval crosses zero. Training costs and margins are absent, so no ROI calculation is supported.',
        ],
        [
          'Alex · researcher',
          'I accept the findings and revise: Across twelve complete synthetic records, the unadjusted slope was {{slope}} kUSD of booked revenue per training hour (model-based 95% CI {{lower}} to {{upper}}). The association is uncertain and noncausal.',
        ],
        [
          'Critical reviewer · simulated agent',
          'Also avoid the opposite overclaim that training does not work. These records cannot settle the business decision. Selection, baseline performance and territory opportunity remain plausible explanations.',
        ],
        [
          'Alex · researcher',
          'I save the corrected interpretation and request a fresh consistency review of that version. I frame a stronger future evaluation as a research need, not a recommendation to expand or cancel training.',
        ],
      ],
      artifact:
        'Claim linked to R1: In twelve complete synthetic records, the unadjusted association was {{slope}} kUSD of next-month booked revenue per training hour (model-based 95% CI {{lower}} to {{upper}}).\nRejected wording: “Creates dollars of profit” and “training has no benefit.”\nConsistency response: Accepted the unit, outcome, causality and omitted-uncertainty findings; corrected the saved artifact and requested a new scripted review of the revised version. Historical findings remain part of the decision record.\nRival explanations: Baseline selling ability, manager selection, pipeline quality and territory opportunity.\nBusiness implications: These data do not support a program expansion/cancellation decision or an ROI estimate. A stronger evaluation would need a defensible comparison, baseline measures and appropriate cost and margin data.\nLimits: Fictional small sample; unknown missingness; no adjustment; assumptions unverified. A clean scripted consistency review does not validate the research.',
      understanding:
        'An executive audience needs the uncertainty and correct business measure just as much as an academic reader. Neither a positive point estimate nor an interval crossing zero settles a management decision.',
      review:
        'Fictional supervisor: The revised summary aligns with the protocol and recorded output. Do not translate this teaching result into advice for a real firm.',
      carry:
        'The final report keeps the correct units, interval, competing explanations and unanswered managerial question alongside the result.',
      challenge: {
        question: 'The interval crosses zero. What conclusion is justified?',
        choices: [
          'The training program has no value',
          'The estimate is uncertain; this design does not determine program value',
        ],
        correct: 1,
        feedback:
          'Failure to establish a precise positive association is not evidence of equivalence or zero value. This model also lacks the design and measures needed for program evaluation.',
      },
    },
    {
      id: 'writing',
      title: 'Write, review and share the research',
      where:
        'Write and explain your decisions → Supervisor checkpoint → Export project → Readable report or project backup; Data / Analysis tasks → Download reproduction bundle',
      input:
        'The research package combines the question, mechanism and rival explanation, protocol, audit, actual R results and corrected business claim. Writing and literature review can begin earlier and continue throughout; this phase assembles and reviews the complete package.',
      turns: [
        [
          'Alex · researcher',
          'I need an academic report and a short summary for the sales director. Can the summary leave out the interval?',
        ],
        [
          'Writing mentor · simulated agent',
          'Keep both faithful to the same evidence. The executive summary can be shorter, but it must retain uncertainty, revenue units and the inability to estimate impact or ROI.',
        ],
        [
          'Alex · researcher',
          'I assemble the teaching report, source excerpts, synthetic CSV, exact R script, output tables, residuals, figure and environment. I describe all conversations and reviews as scripted.',
        ],
        [
          'Professor Patel · fictional supervisor',
          'The business-school teaching case is complete. A real dissertation would additionally need verified literature, a defensible contribution, adequate study design, appropriate data access and expert review.',
        ],
        [
          'Alex · researcher',
          'My final summary says the example illustrates an uncertain association and does not answer whether the company should invest in training. The research process has clarified what we need to learn next.',
        ],
      ],
      artifact:
        'TEACHING REPORT — fictional company and synthetic employee records\nTitle: Employee training and subsequent sales revenue: a reproducible observational demonstration.\nMotivation: Explore a skill-development hypothesis while considering manager selection and territory opportunity. No verified literature contribution is claimed.\nMethods: Fourteen synthetic representatives; April training hours and May revenue in kUSD; unadjusted simple regression; twelve complete cases and two exclusions. Authored tutorial, not preregistered research.\nResults: Slope {{slope}} kUSD/hour (model-based 95% CI {{lower}} to {{upper}}). Exact outputs, code and environment attached.\nDiscussion: Imprecise, noncausal association; baseline performance and selection are unmeasured. No profitability or ROI estimate is possible.\nExecutive summary: This fictional exercise does not establish that training changes revenue or pays for itself. It also does not establish that training has no value. A stronger evaluation is needed to answer the managerial question.\nTransparency: All company records, source excerpts, conversations and reviews are invented. R computed the bundled numerical outputs.\nPackage: Walkthrough and decisions, teaching sources, original CSV, selected input, script, tables, diagnostics, figure, log and session information.',
      understanding:
        'The scholarly report and executive summary can differ in length and emphasis, but they must agree about what was measured, what was estimated and what remains unknown.',
      review:
        'Fictional supervisor: Complete for teaching, not a real approval, company evaluation or submission-ready dissertation.',
      carry:
        'Download the example and return to your notebook. To practice, import the training-sales CSV under Run analysis and review your own plan before execution.',
    },
  ],
};
