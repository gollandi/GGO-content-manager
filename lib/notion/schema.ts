export const SCHEMA = {
    ContentMaster: {
        databaseId: process.env.NOTION_CONTENT_ASSETS_DB!,
        // Core
        title: "Title",
        contentType: "Medical Category", // Select
        status: "Status", // Select
        slug: "Sanity Slug", // RichText

        // Metadata
        lastReviewed: "Last Reviewed", // Date
        reviewedBy: "Reviewed By", // People
        metaDescription: "Meta Description", // RichText
        metaTitle: "Meta Title", // RichText

        // Relations
        pifReviews: "PIF TICK Reviews",
        evidenceSources: "Evidence Sources",
        schemaValidation: "Schema Validation",
        parentPage: "Parent Page",

        // Selects/Multi-Selects
        platform: "Platform",
        pathway: "Pathway",
        interactiveElements: "Interactive Elements",
        transcriptStatus: "Transcript Status",
        contentLocation: "Content Location",
        ctaQuality: "CTA Quality",
        toneScore: "Tone Score",
        duration: "Duration",

        // Other
        hasDisclaimer: "Has Disclaimer", // Checkbox
        youtubeId: "YouTube Video ID", // RichText
        liveUrl: "Live URL", // URL
        sanityId: "Sanity ID", // RichText
        notes: "Notes",
    },

    PifValidation: {
        databaseId: process.env.NOTION_PIF_TICK_COMPLIANCE_DB!,
        title: "Content Asset 1", // Title property

        // Status
        pifTickStatus: "PIF Tick Status", // Formula (String output)
        reviewDate: "Review Date", // Date
        reviewer: "Reviewer", // People

        // Checklist (Booleans/Checkbox)
        evidenceBasedReview: "Evidence-Based Review",
        contentNeedDocumented: "Content Need Documented",
        patientReadability: "Patient Readability",
        inclusivityAssessment: "Inclusivity Assessment",
        expertPeerReview: "Expert Peer Review",
        pifTickDeclaration: "PIF TICK Declaration",

        // Scores
        readabilityTier1: "Readability Tier 1", // Number
        readabilityTier2: "Readability Tier 2", // Number

        // Relations
        contentAsset: "Content Asset (relation)",
        evidenceSourcesUsed: "Evidence Sources Used",

        // Notes
        automationLog: "Automation Log",
        complianceMismatch: "Compliance Mismatch",
        llmProvisionalResult: "LLM Provisional Result",
        patientInvolvementActions: "Patient Involvement Actions",
        patientInvolvementMethod: "Patient Involvement Method",
        patientInvolvementSampleSize: "Patient Involvement Sample Size",
        patientInvolvementDone: "Patient Involvement Done",
        patientInvolvementOutput: "Patient Involvement Output",
        bannerAllowed: "Banner Allowed?",
        inclusivityNotes: "Inclusivity Notes",
        contentNeedNotes: "Content Need Notes",
    },

    Evidence: {
        databaseId: process.env.NOTION_EVIDENCE_SOURCES_DB!,
        title: "Source Name",

        // Properties
        organisation: "Organisation", // Select
        url: "URL", // URL
        lastUpdated: "Last Updated", // Date
        datePublished: "Date Published", // Date
        currencyStatus: "Currency Status", // Select
        topicsCovered: "Topics Covered", // Multi-select
        guidelineCode: "Guideline Code", // RichText
        notes: "Notes", // RichText

        // Relations
        contentAssets: "Content Assets",
    },

    SchemaValidation: {
        databaseId: process.env.NOTION_SCHEMA_VALIDATION_DB!,
        title: "Name",

        // Properties
        slug: "Slug",
        relatedConditions: "Related Conditions",
        schemaType: "Schema Type",
        hasFaq: "Has FAQ",
        validated: "Validated",
        relatedProcedures: "Related Procedures",
        validationErrors: "Validation Errors",
        validationWarnings: "Validation Warnings",
        faqCount: "FAQ Count",
        parentPage: "Parent Page",
        contentAssets: "📄 Content Assets",
        url: "URL",
        pageType: "Page Type",
        breadcrumbs: "Breadcrumbs",
        lastReviewed: "Last Reviewed",
        dateModified: "Date Modified",
        mainEntity: "Main Entity",
        datePublished: "Date Published",
        jsonLdRaw: "JSON-LD Raw",
        faqsSchemaTypes: "FAQsSchema Types",
        notes: "Notes",
    },

    Keywords: {
        databaseId: process.env.NOTION_KEYWORDS_DB!,
        keyword: "Keyword",
        volume: "Volume",
        searchVolume: "Search Volume",
        difficulty: "Difficulty",
        intent: "Intent",
        currentRanking: "Current Ranking",
        positionChange: "Position Change",
        traffic: "Traffic",
        cpc: "CPC",
        competitiveDensity: "Competitive Density",
        trend: "Trend",
        serpFeatures: "SERP Features",
        lastUpdated: "Last Updated",
        lastSemrushUpdate: "Last SEMrush Update",
        semrushUrl: "SEMRush URL",
        contentAssets: "Content Assets",
        notes: "Notes",
    },

    PatientJourneys: {
        databaseId: process.env.NOTION_PATIENT_JOURNEYS_DB!,
        patientLanguage: "Patient Language",
        exampleQuestion: "Example Question",
        journeyStage: "Journey Stage",
        urgency: "Urgency",
        pathway: "Pathway",
        medicalTerms: "Medical Term(s)",
        contentAssets: "Content Assets",
        notes: "Notes",
    },

    StakeholderFeedback: {
        databaseId: process.env.NOTION_STAKEHOLDER_FEEDBACK_DB!,
        feedbackId: "Feedback ID",           // Title
        feedbackType: "Feedback Type",        // Select: Patient/Expert/Clinician/Public
        feedbackDate: "Feedback Date",        // Date
        feedbackSummary: "Feedback Summary",  // Text
        relatedContent: "Related Content",    // Relation to Content Assets
        actionRequired: "Action Required",    // Checkbox
        actionStatus: "Action Status",        // Status: Not Started/In Progress/Completed
        actionOwner: "Action Owner",          // Person
        actionTaken: "Action Taken",          // Text
    },

    AnnualReviewLog: {
        databaseId: process.env.NOTION_ANNUAL_REVIEW_LOG_DB!,
        entry: "Entry",                                    // Title
        criterion: "Criterion",                            // Select (21 options: 1.1...10.1)
        cycle: "Cycle",                                    // Select (FY2026...FY2030)
        reviewDate: "Review Date",                         // Date
        needsDiscussion: "Needs Discussion",               // Checkbox
        pendingFromPreviousCycle: "Pending from Previous Cycle",  // Text
        structuralChange: "Structural Change This Cycle",  // Text
    },

    ContentRequests: {
        databaseId: process.env.NOTION_CONTENT_REQUESTS_DB!,
        requestTitle: "Request Title",        // Title
        requestSource: "Request Source",      // Select: Patient/Clinician/Analytics/Team
        priority: "Priority",                 // Select: High/Medium/Low
        status: "Status",                     // Status: Not Started/Planning/Creating/Review/Published
        requestDate: "Request Date",          // Date
        dueDate: "Due Date",                  // Date
        assignedTo: "Assigned To",            // Person
        targetAudience: "Target Audience",    // Multi-select
        formatRequested: "Format Requested",  // Select: Blog/Video/Guide/Infographic
        whyNeeded: "Why Needed",              // Text
        resultingContent: "Resulting Content",// Relation to Content Assets
    }
} as const;
