CREATE TABLE self_assessments (
    id UUID PRIMARY KEY,
    goal_id UUID NOT NULL,
    period_id UUID NOT NULL,
    self_rating NUMERIC,
    self_comment TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE
);
