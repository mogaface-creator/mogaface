export interface ResearchCard { lead: string; title?: string; body: string; citation: string; href?: string }
export interface ResearchCategory { id: string; label: string; cards: ResearchCard[] }

// Reference topics and bibliographic details checked against the public Qoves tabs.
// Health summaries are scoped to the cited studies, rather than clinical promises.
export const RESEARCH_CATEGORIES: ResearchCategory[] = [
 {id:"finances",label:"Finances",cards:[
  {lead:"Higher",title:"salary",body:"Attractive people earn 10–15% more",citation:"Hamermesh, D. S., and J. E. Biddle. (1994). The American Economic Review."},
  {lead:"Easier",title:"job interviews",body:"Attractive job applicants are perceived as more qualified",citation:"Puleo, R. (2006). Journal of Undergraduate Psychological Research."},
  {lead:"Bigger",title:"tips",body:"Attractive servers receive $1,261 more in tips annually",citation:"Parrett, M. (2015). Journal of Economic Psychology."},
  {lead:"More",title:"sales",body:"Customers are 55% more likely to buy from attractive sales people",citation:"Reingen, P. H., & Kernan, J. B. (1993). Journal of Consumer Psychology."},
 ]},
 {id:"dating",label:"Dating",cards:[
  {lead:"More",title:"swipes",body:"Dating-app photos outweighed biographies by roughly nine to one in one study.",citation:"Witmer, Rosenbusch & Meral (2025). Computers in Human Behavior Reports."},
  {lead:"More",title:"second-dates",body:"Appearance predicted attraction in speed-dating research.",citation:"Eastwick & Finkel (2008); Luo & Zhang (2009). Journal of Personality and Social Psychology."},
  {lead:"More desirable",title:"partners",body:"Partners tend to have similar attractiveness ratings.",citation:"Luo (2017). Social and Personality Psychology Compass."},
  {lead:"More important",title:"than we think",body:"Stated preferences can underplay appearance in romantic decisions.",citation:"Eastwick et al. (2024). Journal of Personality and Social Psychology."},
 ]},
 {id:"socializing",label:"Socializing",cards:[
  {lead:"Funnier",body:"Attractive people are found funnier on video than in audio",citation:"Cowan, M. L., & Little, A. C. (2013). Personality and Individual Differences."},
  {lead:"Healthier",body:"Attractive people are perceived to be healthier",citation:"Zebrowitz, L. A., & Franklin Jr, R. G. (2014). Experimental Aging Research."},
  {lead:"Smarter",body:"Attractive people are thought to be more intelligent",citation:"Moore, F. R., Filippou, D., & Perrett, D. I. (2011). Journal of Evolutionary Psychology."},
  {lead:"Better",body:"Attractive people are perceived as more moral and trustworthy",citation:"Shinners, E. (2009). UW-L Journal of Undergraduate Research; Klebl et al. (2022). Journal of Nonverbal Behavior."},
 ]},
 {id:"health",label:"Health",cards:[
  {lead:"Better",title:"treatment",body:"In an X-ray experiment, missed stone diagnoses were 3.67 times more likely for patients rated less attractive.",citation:"Tsiga, Panagopoulou & Benos (2016). European Journal for Person Centered Healthcare.",href:"https://doi.org/10.5750/ejpch.v4i3.1098"},
  {lead:"Healthier",title:"lifestyle",body:"A study of young men examined links between health symptoms, body fat and facial attractiveness ratings.",citation:"Arnocky & Davis (2024). Frontiers in Psychology.",href:"https://doi.org/10.3389/fpsyg.2024.1404387"},
  {lead:"Longer",title:"lives",body:"A small historical yearbook study linked attractiveness ratings with longevity; it did not establish causation.",citation:"Henderson & Anglin (2003). Evolution and Human Behavior.",href:"https://doi.org/10.1016/S1090-5138(03)00036-9"},
 ]},
 {id:"education",label:"Education",cards:[
  {lead:"Better",title:"teacher perceptions",body:"Students rated attractive received more favorable teacher judgments.",citation:"Ritts, Patterson & Tubbs (1992). Review of Educational Research; Talamas, Mavor & Perrett (2016). PLoS ONE."},
  {lead:"Better",title:"student perceptions",body:"Professor appearance was associated with student evaluations.",citation:"Theyson (2015). Practical Assessment, Research, and Evaluation."},
  {lead:"Higher",title:"grades",body:"Studies compared appearance-related grading differences online and in person.",citation:"Hernández-Julián & Peters (2017). Journal of Human Capital; Mehic (2022). Economics Letters."},
 ]},
 {id:"law",label:"Law",cards:[
  {lead:"Fewer",title:"arrests",body:"Appearance ratings were associated with arrest likelihood.",citation:"Beaver, Boccio, Smith & Ferguson (2019). Psychiatry, Psychology and Law."},
  {lead:"Fewer",title:"convictions",body:"Researchers also examined appearance and conviction outcomes.",citation:"Beaver, Boccio, Smith & Ferguson (2019). Psychiatry, Psychology and Law."},
  {lead:"Lighter",title:"sentences",body:"A meta-analysis examined attractiveness bias in sentencing judgments.",citation:"Mazzella & Feingold (1994). Journal of Applied Social Psychology."},
 ]},
 {id:"influence",label:"Influence",cards:[
  {lead:"Better",title:"networking",body:"Attractiveness ratings were linked with denser social networks.",citation:"O’Connor & Gladstone (2018). Social Networks."},
  {lead:"More",title:"leadership",body:"Research examined appearance-related advantages in electoral support.",citation:"Jaeger et al. (2021). Social Psychology."},
  {lead:"More",title:"promotions",body:"Appearance was associated with promotion judgments.",citation:"Morrow, McElroy, Stamper & Wilson (1990). Journal of Management."},
  {lead:"More",title:"followers",body:"Studies explored appearance-related differences in social-media engagement.",citation:"Gladstone & O’Connor (2013). Academy of Management Proceedings; Strey (2019). MSc dissertation, Lund University."},
 ]},
 {id:"happiness",label:"Happiness",cards:[
  {lead:"Higher",title:"well-being",body:"Longitudinal research found an association with psychological well-being.",citation:"Datta Gupta, Etcoff & Jaeger (2016). Journal of Happiness Studies.",href:"https://doi.org/10.1007/s10902-015-9644-6"},
  {lead:"Lower",title:"mental illness",body:"Studies explored mental-health associations; appearance cannot diagnose illness.",citation:"Farina et al. (1977). Journal of Abnormal Psychology; Borráz-León et al. (2021). Adaptive Human Behavior and Physiology."},
 ]},
];
