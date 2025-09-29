CREATE TABLE supervisor_reviews (
    id UUID PRIMARY KEY,
    goal_id UUID NOT NULL,
    period_id UUID NOT NULL,
    supervisor_id UUID NOT NULL,
    action TEXT NOT NULL, -- (APPROVED, REJECTED, PENDING)
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE
);
