// Authored teaching simulation. All people, sources and observations are fictional.
export const demoCSV = 'study_hours,quiz_score\n1,2\n2,4\n3,5\n4,8\n5,9\n6,12\n7,NA\n,10\n';
export const demoCase = {
  id: 'maya-first-study',
  title: 'Does studying longer mean higher quiz scores?',
  subtitle:
    'Follow Maya Chen, a fictional first-year PhD student, through her first small observational study.',
  disclosure:
    'Teaching simulation: all people, source excerpts, conversations, reviews and data are invented. Numerical results were computed by the app’s real R runner when this demo was built. Opening the demo makes no AI calls and runs no analysis.',
  stages: [
    {
      id: 'question',
      title: 'Frame the question',
      where: 'Guided conversation → Your workspace → Supervisor review',
      input:
        'Maya starts with an interest in study habits and an eight-row synthetic class dataset.',
      turns: [
        [
          'Maya · researcher',
          'I want to prove that more studying improves learning. Can you write my question?',
        ],
        [
          'Methods mentor · simulated agent',
          'First, what do you actually measure, and did anyone assign the study time?',
        ],
        [
          'Maya · researcher',
          'Weekly self-reported study hours and a quiz score out of 15. Nobody assigned study hours. These are invented records for practice.',
        ],
        [
          'Methods mentor · simulated agent',
          'Then ask about an association, not an improvement caused by studying. Limit the question to this sample and this quiz. A weak or negative relationship must also be an acceptable answer.',
        ],
        [
          'Maya · researcher',
          'My question is: In this synthetic class sample, how are weekly study hours associated with quiz scores? Prior knowledge and motivation may explain the relationship. I accept this revised draft.',
        ],
      ],
      artifact:
        'Research question: In this synthetic class sample, how are weekly self-reported study hours associated with quiz scores?\nPopulation: Eight fictional first-year students in one fictional class.\nExposure: Study hours in the week before the quiz.\nOutcome: Quiz score, 0–15 points.\nData: Author-created synthetic records; no real participants or personal data.\nBoundary: A descriptive, unadjusted association. No causal claim or inference about universities generally.',
      understanding:
        'My measurements can describe an association, but cannot tell me what would happen if the same student were made to study longer.',
      review:
        'Dr. Rivera · fictional supervisor: Accept the bounded question for this exercise. Real work also requires confirmation of access, ethics requirements and an adequate design.',
      carry:
        'The population, variable definitions and noncausal scope now constrain the evidence search, design and final claims.',
      challenge: {
        question: 'Which question matches the available design?',
        choices: [
          'Does extra studying cause better learning?',
          'How are recorded study hours associated with quiz scores?',
        ],
        correct: 1,
        feedback:
          'The second question matches an observational comparison. Writing a causal question does not make the data causal.',
      },
    },
    {
      id: 'evidence',
      title: 'Read and challenge the evidence',
      where: 'Sources → Claims & evidence → Your workspace',
      input:
        'The saved question determines the concepts to search: study time, quiz performance and observational university studies.',
      turns: [
        [
          'Maya · researcher',
          'I found an example passage saying students who study more score higher. Can I cite it as proof that studying works?',
        ],
        [
          'Evidence mentor · simulated agent',
          'Inspect the exact passage and its design. Link a narrow claim to the source and record evidence that challenges your expectation.',
        ],
        [
          'Maya · researcher',
          'Teaching source S1 reports an association, but no random assignment. S2 says that accounting for prior achievement weakened the association. Both are fictional teaching excerpts, not publications.',
        ],
        [
          'Evidence checker · simulated agent',
          'S1 supports a reported association in its sample. It does not establish causation or support a claim about every student. S2 motivates confounding as a design limitation.',
        ],
        [
          'Maya · researcher',
          'I reject my causal claim. I record a narrower claim and mark its support as limited to the quoted teaching passage. A real project needs verified papers and a documented search.',
        ],
      ],
      sources: [
        {
          id: 'S1',
          title: 'Teaching excerpt A — unadjusted study-time association (fictional)',
          passage:
            'In this fictional observational class sample, students reporting more weekly study hours tended to have higher quiz scores. Study time was not randomly assigned.',
          limitation: 'No causal identification; narrow setting; self-reported exposure.',
        },
        {
          id: 'S2',
          title: 'Teaching excerpt B — prior achievement matters (fictional)',
          passage:
            'In this fictional example, the association between study time and quiz performance weakened after prior achievement was included in the model.',
          limitation: 'Illustrates a competing explanation; it is not real empirical evidence.',
        },
      ],
      artifact:
        'Search plan for real work: Search appropriate scholarly databases for (study time OR study hours) AND (quiz OR academic performance) AND university; record database, date, query and inclusion decisions. No real search was performed in this demo.\nS1: A fictional unadjusted association; inspected passage does not justify causation.\nS2: A fictional example challenging the simple story through prior-achievement adjustment.\nClaim C1: S1 describes an association in its fictional sample. Decision: Accept this narrow reading only.\nRejected claim: S1 proves study hours improve learning.\nGap: This exercise explores a small dataset; it establishes no novel literature gap.',
      understanding:
        'Counting positive passages is not an evidence synthesis. Design differences and competing explanations matter more than whether a passage agrees with me.',
      review:
        'Fictional supervisor: The evidence logic is adequate for a tutorial. These excerpts cannot be cited in a real manuscript; conduct and verify a real literature search.',
      carry:
        'Possible confounding becomes an explicit protocol limitation and later reappears in the interpretation.',
    },
    {
      id: 'design',
      title: 'Choose the design before the result',
      where: 'Guided conversation → Your workspace → Supervisor review',
      input:
        'The saved question asks for an association; the evidence map identifies prior achievement as a possible confounder.',
      turns: [
        ['Maya · researcher', 'Which analysis will give the most significant result?'],
        [
          'Methods mentor · simulated agent',
          'Choose the analysis from the question before inspecting the estimate. What is the observational unit, missing-data rule and scope of the model?',
        ],
        [
          'Maya · researcher',
          'One row is one fictional student. I will fit quiz_score ~ study_hours using rows with both values. I will report how many rows are excluded.',
        ],
        [
          'Methods mentor · simulated agent',
          'That is a simple unadjusted regression supported by this app. Check linearity, residual patterns and influential observations. The small sample makes these checks weak; no prior-achievement variable is available.',
        ],
        [
          'Maya · researcher',
          'I accept that limitation and freeze the plan. This is an authored teaching sequence, not a timestamped preregistration. A real analysis must disclose prior exposure to results.',
        ],
      ],
      artifact:
        'Design: Small observational secondary analysis of synthetic records. Unit: One fictional student per row.\nModel: quiz_score = intercept + slope × study_hours + error.\nPrimary quantity: Unadjusted slope in quiz points per additional reported study hour, with a model-based 95% confidence interval.\nMissing data: Complete cases on the two selected variables; report total, included and excluded rows. No imputation.\nDiagnostics: Inspect fitted values and residuals; assess linearity and unequal variance cautiously. Influence and sensitivity analyses require further work.\nAssumptions: Independent observations, an adequate linear conditional mean, and model assumptions for interval estimation.\nConfounding: Prior achievement and motivation are unmeasured; no causal interpretation.\nPrior exposure: Authored synthetic tutorial, constructed with known results; not preregistered research.\nEthics: No real people; real studies require institution-specific ethics and data-access checks.',
      understanding:
        'Selecting a method to obtain a small p-value would change the question after seeing the answer. Missingness can also select a biased subset.',
      review:
        'Fictional supervisor: Approve this limited teaching protocol. Do not present eight invented observations as a powered study or preregistration.',
      carry:
        'The exact variables, complete-case rule and noncausal interpretation guide profiling, execution approval and consistency checks.',
    },
    {
      id: 'data',
      title: 'Inspect the data and document exclusions',
      where: 'Run analysis → Import a permitted CSV dataset → Your workspace',
      input: 'The protocol specifies two numeric variables and complete-case analysis.',
      turns: [
        [
          'Maya · researcher',
          'I have uploaded the synthetic CSV. Should I replace blanks with zero?',
        ],
        [
          'Data mentor · simulated agent',
          'No. A missing quiz is not a zero quiz score. Inspect missingness, units, ranges and provenance before running the planned analysis.',
        ],
        [
          'Maya · researcher',
          'There are eight records, one missing study-hours value and one missing quiz score on different rows. Six rows have both variables. Recorded hours range from 1 to 7; recorded scores from 2 to 12.',
        ],
        [
          'Data mentor · simulated agent',
          'Keep the original CSV and its hash. Report why two rows are excluded and what is unknown about missingness. A numeric profile alone cannot establish that each row is a unique eligible person.',
        ],
        [
          'Maya · researcher',
          'The tutorial author defines each row as a distinct fictional student. I retain NA and blank cells, use the planned six complete cases, and document that no missingness mechanism is known.',
        ],
      ],
      artifact:
        'Dataset D1: synthetic-study-hours.csv; eight author-created rows, two numeric columns.\nDictionary: study_hours = weekly hours, nonnegative; quiz_score = points, 0–15.\nObserved ranges: Hours 1–7; quiz scores 2–12. No recorded out-of-range value.\nMissingness: Row 7 has no quiz score; row 8 has no study-hours value. Six complete cases; two excluded from regression.\nIdentity: Exact CSV preserved and SHA-256 recorded with the execution bundle.\nDuplicates and eligibility: All rows are distinct by tutorial construction; no real participant identity verification was performed.\nCleaning: No value replacement or imputation.\nProtocol deviations: None. Unknown missingness mechanism limits interpretation.',
      understanding:
        'Replacing a blank with zero would invent a measurement and change the slope. Exclusion counts alone do not prove missingness is harmless.',
      review:
        'Fictional supervisor: The missing-data decision matches the protocol. Retain the original rows and report the reduced analysis sample.',
      carry:
        'The dataset hash and variable mappings bind the approved plan to the exact input used in R.',
      challenge: {
        question: 'How many rows should the planned regression use?',
        choices: [
          'All 8, replacing missing values with zero',
          '6 complete rows, reporting the 2 exclusions',
        ],
        correct: 1,
        feedback:
          'Six rows match the planned complete-case rule. Zero replacement would invent data and deviate from the protocol.',
      },
    },
    {
      id: 'analysis',
      title: 'Approve the plan and inspect real outputs',
      where: 'Run analysis → Propose a plan → Review script → Approve → Run',
      input:
        'The saved question, design and data report constrain the plan. The dataset has six complete cases.',
      turns: [
        [
          'Maya · researcher',
          'Please propose the analysis using my saved protocol and dataset profile.',
        ],
        [
          'Analysis mentor · simulated agent',
          'Use the fixed simple linear regression template: outcome quiz_score, predictor study_hours. Omit incomplete rows as planned. This estimates an unadjusted association.',
        ],
        [
          'Maya · researcher',
          'I review the variable mapping, complete-case rule and exact R script. I approve this plan for these synthetic data and run it.',
        ],
        [
          'Local R runner · recorded computation',
          'The attached execution record contains the actual numerical outputs from the app’s R template, including coefficients, confidence intervals, residuals, counts and session information.',
        ],
        [
          'Maya · researcher',
          'Six rows were used and two excluded. The slope is about 1.943 quiz points per hour, with a model-based 95% interval of 1.568 to 2.318. The residuals are small in this constructed dataset, but six observations cannot establish that the assumptions hold.',
        ],
        [
          'Analysis mentor · simulated agent',
          'Keep the code, input and outputs together. If the question, design or data report changes, review a new current plan before rerunning; an old output cannot silently answer a revised question.',
        ],
      ],
      artifact:
        'Execution: R1, computed from synthetic data using the app’s fixed local R template.\nModel: quiz_score ~ study_hours, six complete cases from eight rows.\nSlope: 1.942857 quiz points/hour; model-based 95% CI 1.567972 to 2.317742.\nIntercept: -0.133333 quiz points.\nReproduction: Save input.csv and analysis.R from the bundle in a clean directory, then run Rscript analysis.R. Exact versions are in session.txt.\nDiagnostics: Inspect diagnostics.csv. The exact fitted values and residuals are in the attached output; estimates may be sensitive to individual rows. No comprehensive influence or sensitivity assessment was performed.\nInterpretation limits: Constructed sample; tiny n; missingness; no adjustment; model-based interval is not protection against bias.\nExploratory analyses: None.',
      understanding:
        'The language model proposed a plan; R computed the numbers. Approval records a deliberate decision, not proof that the chosen model is scientifically adequate.',
      review:
        'Fictional supervisor: The run is reproducible. Keep the limitations visible and do not mistake a narrow model interval for reliable evidence about real students.',
      carry:
        'Recorded estimates and exclusions feed the claims and consistency review. The original input, exact script and environment accompany the research package.',
    },
    {
      id: 'interpretation',
      title: 'Catch an unsupported conclusion',
      where: 'Your workspace → Consistency review → Researcher response',
      input:
        'The question and protocol are noncausal. R1 estimates an unadjusted slope from six synthetic complete cases.',
      turns: [
        [
          'Maya · researcher',
          'My conclusion is: Each extra hour of study improves students’ quiz scores by 1.94 points.',
        ],
        [
          'Consistency reviewer · simulated agent',
          'Mismatch: the protocol says “no causal interpretation,” but “improves” implies causation. The output is an unadjusted association in six synthetic records.',
        ],
        [
          'Maya · researcher',
          'I accept that finding. I revise the claim: In six complete synthetic records, one additional reported study hour was associated with an estimated 1.94-point higher quiz score.',
        ],
        [
          'Critical reviewer · simulated agent',
          'Add uncertainty and plausible alternatives. Prior achievement, motivation and selective missingness remain unresolved. The fictional sources do not independently validate the result.',
        ],
        [
          'Maya · researcher',
          'I save the corrected interpretation and rerun the consistency review so it checks the current version. The scripted follow-up finds no remaining causal wording mismatch; that is not a certification of quality.',
        ],
      ],
      artifact:
        'Claim linked to R1: In six complete synthetic records, one additional reported study hour was associated with an estimated 1.94-point higher quiz score (model-based 95% CI 1.57–2.32).\nRejected wording: “Each extra hour improves scores.”\nAlternative explanations: Prior achievement, motivation, reporting error and missingness.\nLimits: Tiny constructed sample; no confounder adjustment; no causal identification or external generalizability.\nConsistency response: Accepted the causal-language finding and revised the artifact. A new scripted review checks the revised version; the previous review remains historical.\nUnknown: Whether a similar association exists in a real population or changing study time causes any benefit.',
      understanding:
        'A fitted slope does not show what an intervention would do. A consistency check can detect contradictions but cannot supply missing data or validate the study.',
      review:
        'Fictional supervisor: The revised wording matches the design and output. It remains a demonstration, not an empirical finding for publication.',
      carry:
        'The corrected claim, uncertainty, competing explanations and unresolved limitations must all remain in the final manuscript.',
      challenge: {
        question: 'Does a clean consistency review establish that this study is rigorous?',
        choices: [
          'Yes; all scientific problems are resolved',
          'No; aligned claims still need sound data, methods and expert review',
        ],
        correct: 1,
        feedback:
          'Consistency is one check. It cannot establish source truth, adequate power, valid assumptions or freedom from bias.',
      },
    },
    {
      id: 'writing',
      title: 'Assemble the complete research package',
      where:
        'Your workspace → Supervisor review → Export notebook / JSON; Run analysis → Download reproduction bundle',
      input:
        'The final package combines the bounded question, source limitations, frozen decisions, actual R outputs and revised interpretation.',
      turns: [
        ['Maya · researcher', 'Can we turn this into a paper now?'],
        [
          'Writing mentor · simulated agent',
          'For this exercise, create a clearly labeled teaching report. Include methods, exclusions, results and limitations, and attach the data and script. Do not present invented citations or observations as real research.',
        ],
        [
          'Maya · researcher',
          'I export the walkthrough, source excerpts, synthetic CSV, exact R script, run outputs and session information. I disclose the scripted agent assistance and my responsibility for each decision.',
        ],
        [
          'Dr. Rivera · fictional supervisor',
          'The teaching package is complete for this bounded example. For real research, verify literature, permissions, study adequacy and diagnostics with qualified supervision before submission.',
        ],
        [
          'Maya · researcher',
          'I now understand the cycle: discuss, inspect, revise, explain, review and carry the accepted decisions forward. I still need to make and defend the scientific choices myself.',
        ],
      ],
      artifact:
        'TEACHING REPORT — synthetic data; no real empirical claims\nTitle: Study hours and quiz scores in a fictional class: a reproducible demonstration.\nQuestion: How are weekly study hours associated with quiz scores in this synthetic sample?\nMethods: Eight constructed records; unadjusted simple linear regression; six complete cases, two excluded. No imputation. No preregistration or real literature search.\nResults: Estimated slope 1.94 quiz points/hour (model-based 95% CI 1.57–2.32). The exact computation, input and environment are attached.\nDiscussion: This illustrates workflow continuity and reproducibility. The result establishes nothing about real students and cannot support an intervention recommendation.\nLimitations: Invented sources and observations; tiny sample; missingness; unmeasured confounding; incomplete diagnostic assessment.\nTransparency: Conversations and reviews are authored simulations. Numerical outputs come from actual local R execution. All teaching materials are labeled fictional.\nPackage: Walkthrough and decision record, two teaching excerpts, original CSV, selected R input, fixed script, coefficients, diagnostics, figure, log and session information.\nNext real-world step: Develop an adequate study with verified literature and expert supervision.',
      understanding:
        'A complete package lets another person inspect what I did and why. Reproducibility is necessary, but does not make a weak or fictional study valid.',
      review:
        'Fictional supervisor: Teaching walkthrough complete. No real supervisor approval, ethics approval or publication readiness is implied.',
      carry:
        'Download the materials below, then return to your notebook. To practice execution, import the synthetic CSV under Run analysis and review your own plan before running it.',
    },
  ],
};
