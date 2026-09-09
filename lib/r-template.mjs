// Only these reviewed templates execute. Model output and user text are never evaluated as R code.
export const ANALYSIS_TEMPLATE_VERSION = 1;
export function analysisScript(method) {
  if (!['descriptive', 'linear'].includes(method)) throw new Error('Unsupported method');
  return `# ResearchGuide analysis template v1; input.csv uses y (outcome) and optional x (predictor).
# Complete-case analysis: blank/NA values are excluded and counts are recorded.
options(warn=1)
d <- read.csv('input.csv', na.strings='NA', check.names=FALSE)
original_n <- nrow(d)
d <- d[complete.cases(d), , drop=FALSE]
if (nrow(d) < ${method === 'linear' ? 3 : 2}) stop('Too few complete observations.')
write.csv(data.frame(total=original_n, used=nrow(d), excluded=original_n-nrow(d)), 'counts.csv', row.names=FALSE)
describe <- function(v) c(n=length(v), mean=mean(v), sd=sd(v), median=median(v), min=min(v), max=max(v))
write.csv(data.frame(variable=names(d), t(vapply(d,describe,numeric(6))), check.names=FALSE), 'descriptives.csv', row.names=FALSE)
${
  method === 'linear'
    ? `if (length(unique(d$x)) < 2 || length(unique(d$y)) < 2) stop('Regression requires variation in both variables.')
fit <- lm(y ~ x, data=d)
if (fit$rank < 2) stop('The regression design is rank deficient.')
sm <- summary(fit)
ci <- confint(fit,level=0.95)
write.csv(data.frame(term=rownames(sm$coefficients), estimate=sm$coefficients[,1], std_error=sm$coefficients[,2], statistic=sm$coefficients[,3], p_value=sm$coefficients[,4], lower_95=ci[,1], upper_95=ci[,2]), 'coefficients.csv', row.names=FALSE)
write.csv(data.frame(n=nrow(d), r_squared=sm$r.squared, residual_sd=sm$sigma, residual_df=df.residual(fit)), 'fit.csv', row.names=FALSE)
write.csv(data.frame(fitted=fitted(fit), residual=residuals(fit)), 'diagnostics.csv', row.names=FALSE)
print(sm)
print(ci)
`
    : 'print(summary(d$y))\n'
}
# A reproducible SVG histogram generated from R-computed bin counts.
h <- hist(d$y, plot=FALSE)
height <- 240; width <- 480
bars <- vapply(seq_along(h$counts), function(i) {
 bh <- if(max(h$counts)>0) h$counts[i]/max(h$counts)*180 else 0
 sprintf('<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="#214f42"/>', 40+(i-1)*400/length(h$counts), 200-bh, 390/length(h$counts),bh)
}, character(1))
svg <- paste0('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240"><rect width="480" height="240" fill="#f7f5ed"/><text x="40" y="20">Outcome distribution (complete cases)</text>',paste(bars,collapse=''),sprintf('<text x="40" y="225">Range: %.4g to %.4g; n = %d</text>',min(d$y),max(d$y),nrow(d)),'</svg>')
writeLines(svg,'figure.svg')
write.csv(data.frame(lower=head(h$breaks,-1), upper=tail(h$breaks,-1), count=h$counts),'histogram.csv',row.names=FALSE)
writeLines(capture.output(sessionInfo()),'session.txt')
print(data.frame(total=original_n,used=nrow(d),excluded=original_n-nrow(d)))
`;
}
