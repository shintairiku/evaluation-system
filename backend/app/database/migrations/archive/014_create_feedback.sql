CREATE TABLE supervisor_feedback (
    id UUID PRIMARY KEY,
    self_assessment_id UUID NOT NULL,
    period_id UUID NOT NULL,
    supervisor_id UUID NOT NULL,
    rating NUMERIC,
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (self_assessment_id) REFERENCES self_assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE
);
