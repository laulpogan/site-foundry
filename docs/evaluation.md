# Evaluation

The locked suite contains thirty briefs across marketing and software-product
interfaces. It includes consumer, technical, professional-service, industrial,
creative, local, operational, and data-heavy work.

Run `site-foundry evaluate` to verify the suite hash. Programmatic evaluation accepts
two runners and gives each the same frozen model-call and implementation-time budget.
The harness emits blind A/B screenshot comparisons. Human raters add preferences
before `summarizeEvaluation` can mark a release ready.

Release gates follow `evaluation/rubric.yaml`: at least 70 percent blind preference,
90 percent component reuse, complete imported-code provenance, no access or license
violations, better coherence, no increase in functional or accessibility failures,
and fewer custom components.
