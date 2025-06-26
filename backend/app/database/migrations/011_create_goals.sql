CREATE TABLE goals (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    period_id UUID NOT NULL,
    goal_category_id SMALLINT NOT NULL,
    target_data JSONB,
    weight NUMERIC,
    status TEXT NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    FOREIGN KEY (goal_category_id) REFERENCES goal_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id)
);
