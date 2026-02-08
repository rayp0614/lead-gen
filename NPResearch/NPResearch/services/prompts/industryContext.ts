/**
 * Static Industry Context for CT DDS/Disability Services Sector
 *
 * This replaces unreliable web searches with curated, accurate industry knowledge.
 * Used to generate relevant pain points and pitch angles.
 */

export const CT_DDS_INDUSTRY_CONTEXT = `
=== CONNECTICUT DDS (DEPARTMENT OF DEVELOPMENTAL SERVICES) INDUSTRY CONTEXT ===

1. REGULATORY & COMPLIANCE ENVIRONMENT
--------------------------------------
- Quality Service Reviews (QSR) are conducted by DDS to evaluate provider performance
- Focus Areas assessed: Planning, Community Inclusion, Choice & Control, Rights/Dignity, Safety, Health & Wellness, Satisfaction
- Scores below 80% are considered "High Priority" requiring corrective action plans
- Providers must maintain compliance with DDS licensing requirements
- Annual audits and unannounced site visits are common
- Medicaid billing compliance is heavily scrutinized

Common Pain Points:
- QSR preparation consumes significant staff time
- Documentation requirements are extensive
- Keeping up with regulatory changes is challenging
- Training staff on compliance is ongoing expense

2. FUNDING & REIMBURSEMENT TRENDS
---------------------------------
- Connecticut uses Medicaid waivers for community-based services
- Rate structures are set by DDS and updated periodically
- Providers face chronic underfunding relative to service costs
- Workforce costs (wages, benefits) outpace reimbursement increases
- Billing accuracy and timely submission affects cash flow

Common Pain Points:
- Reimbursement rates don't cover true cost of services
- Cash flow challenges due to billing delays
- Administrative overhead for billing compliance
- Rate negotiations with state are difficult

3. WORKFORCE CHALLENGES
-----------------------
- Direct Support Professionals (DSPs) are in short supply
- High turnover rates (often 40-60% annually)
- Training requirements are substantial (medication administration, safety, rights)
- Competition from retail and other sectors for entry-level workers
- COVID-19 accelerated workforce challenges

Common Pain Points:
- Recruitment is constant and expensive
- Training new staff takes resources from service delivery
- Overtime costs due to staffing gaps
- Burnout among experienced staff

4. TECHNOLOGY ADOPTION GAPS
---------------------------
- Many providers still use paper-based systems
- Electronic Health Records (EHR) adoption is uneven
- Scheduling and time tracking often manual
- Family/guardian communication varies widely
- Data analytics for quality improvement is limited

Technology Opportunities:
- EHR/EMR systems designed for IDD services
- Staff scheduling and workforce management tools
- Billing and revenue cycle management software
- Incident reporting and tracking systems
- Training and compliance management platforms
- Family engagement portals

5. SERVICE DELIVERY MODELS
--------------------------
- Community Living Arrangements (CLA/Group Homes)
- Individualized Supports (ILST)
- Day Services (prevocational, social)
- Employment Services
- Respite Care
- Family Support

Trends:
- Shift toward person-centered planning
- Community integration emphasis (vs. segregated settings)
- Self-direction gaining popularity
- Remote/hybrid service delivery post-COVID

6. COMMON ORGANIZATIONAL CHALLENGES
-----------------------------------
- Aging infrastructure (group homes, vehicles)
- Board governance and succession planning
- Executive director turnover
- Maintaining quality with constrained resources
- Adapting to changing population needs (aging individuals, complex medical needs)

=== USE THIS CONTEXT TO ===
- Identify relevant pain points based on the organization's specific situation
- Suggest solutions that address real industry challenges
- Frame pitches in language familiar to DDS providers
- Avoid generic business advice that doesn't apply to nonprofit human services
`;

export const getIndustryContext = (options?: {
  focusAreas?: ('compliance' | 'funding' | 'workforce' | 'technology' | 'services')[];
}): string => {
  // For now, return full context
  // Future: could filter to specific sections
  return CT_DDS_INDUSTRY_CONTEXT;
};

export default CT_DDS_INDUSTRY_CONTEXT;
