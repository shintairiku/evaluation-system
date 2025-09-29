-- Evaluation System Migration
-- Creates tables for evaluation periods, goals, assessments, and feedback
-- This migration handles the core evaluation workflow functionality

-- Create evaluation periods table
CREATE TABLE evaluation_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    period_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    goal_submission_deadline DATE NOT NULL,
    evaluation_deadline DATE NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create goals table (using string-based categories instead of FK)
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    period_id UUID NOT NULL,
    goal_category VARCHAR(100),
    target_data JSONB,
    weight NUMERIC,
    status TEXT NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Create self assessments table
CREATE TABLE self_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL,
    period_id UUID NOT NULL,
    self_rating NUMERIC,
    self_comment TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE
);

-- Create supervisor reviews table
CREATE TABLE supervisor_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL,
    period_id UUID NOT NULL,
    supervisor_id UUID NOT NULL,
    action TEXT NOT NULL, -- (APPROVED, REJECTED, PENDING)
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create supervisor feedback table
CREATE TABLE supervisor_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    self_assessment_id UUID NOT NULL,
    period_id UUID NOT NULL,
    supervisor_id UUID NOT NULL,
    rating NUMERIC,
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (self_assessment_id) REFERENCES self_assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (period_id) REFERENCES evaluation_periods(id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add indexes for evaluation system performance
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_period_id ON goals(period_id);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_self_assessments_goal_id ON self_assessments(goal_id);
CREATE INDEX idx_self_assessments_period_id ON self_assessments(period_id);
CREATE INDEX idx_supervisor_reviews_goal_id ON supervisor_reviews(goal_id);
CREATE INDEX idx_supervisor_reviews_supervisor_id ON supervisor_reviews(supervisor_id);
CREATE INDEX idx_supervisor_feedback_self_assessment_id ON supervisor_feedback(self_assessment_id);
CREATE INDEX idx_supervisor_feedback_supervisor_id ON supervisor_feedback(supervisor_id);

-- Apply updated_at triggers to evaluation tables
CREATE TRIGGER update_evaluation_periods_updated_at
    BEFORE UPDATE ON evaluation_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_self_assessments_updated_at
    BEFORE UPDATE ON self_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supervisor_reviews_updated_at
    BEFORE UPDATE ON supervisor_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supervisor_feedback_updated_at
    BEFORE UPDATE ON supervisor_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();