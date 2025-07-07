#!/usr/bin/env python3
"""
Performance Evaluation Workflow Integration Tests
Demonstrates end-to-end performance evaluation workflows
"""

import pytest
from unittest.mock import patch, AsyncMock
from uuid import uuid4
from datetime import datetime, timedelta

from tests.integration.test_logging_utils import (
    setup_integration_test_logging,
    log_test_start,
    log_integration_step,
    log_workflow_verification,
    log_end_to_end_test,
    log_database_state,
    log_api_sequence,
    log_component_integration,
    log_assertion_success,
    log_test_summary,
    log_error
)

# Set up centralized logging
TEST_LOG_FILE = setup_integration_test_logging('performance_evaluation_workflows')


class TestPerformanceEvaluationWorkflows:
    """Test performance evaluation workflows end-to-end"""

    @pytest.fixture
    def supervisor_user_data(self):
        """Supervisor user data for evaluation testing"""
        return {
            "sub": "supervisor_eval_test",
            "role": "supervisor",
            "email": "supervisor@eval.test",
            "name": "Evaluation Supervisor"
        }

    @pytest.fixture
    def employee_user_data(self):
        """Employee user data for evaluation testing"""
        return {
            "sub": "employee_eval_test",
            "role": "employee",
            "email": "employee@eval.test",
            "name": "Test Employee",
            "employee_code": "EMP001"
        }

    @pytest.fixture
    def evaluation_period_data(self):
        """Evaluation period data for testing"""
        return {
            "id": uuid4(),
            "name": "Q1 2024 Performance Review",
            "start_date": datetime.now().date(),
            "end_date": (datetime.now() + timedelta(days=30)).date(),
            "status": "active",
            "type": "quarterly"
        }

    @pytest.fixture
    def goal_data(self):
        """Goal data for performance evaluation"""
        return {
            "id": uuid4(),
            "title": "Complete Project Alpha",
            "description": "Deliver project alpha within timeline and budget",
            "category": "project_delivery",
            "target_completion_date": (datetime.now() + timedelta(days=60)).date(),
            "weight": 0.3,
            "status": "in_progress"
        }

    @pytest.mark.asyncio
    async def test_complete_evaluation_cycle_workflow(
        self,
        supervisor_user_data,
        employee_user_data,
        evaluation_period_data,
        goal_data
    ):
        """Test complete evaluation cycle from goal setting to final review"""
        log_test_start("complete_evaluation_cycle_workflow")
        
        try:
            # Mock services
            with patch('app.services.evaluation_service.EvaluationService') as mock_eval_service, \
                 patch('app.services.goal_service.GoalService') as mock_goal_service, \
                 patch('app.services.user_service.UserService') as mock_user_service:
                
                mock_eval_instance = AsyncMock()
                mock_goal_instance = AsyncMock()
                mock_user_instance = AsyncMock()
                mock_eval_service.return_value = mock_eval_instance
                mock_goal_service.return_value = mock_goal_instance
                mock_user_service.return_value = mock_user_instance
                
                # Step 1: Start evaluation period
                log_integration_step(1, "Start evaluation period", {
                    "period_name": evaluation_period_data["name"],
                    "start_date": str(evaluation_period_data["start_date"])
                })
                
                mock_eval_instance.create_evaluation_period.return_value = evaluation_period_data
                
                period_result = await mock_eval_instance.create_evaluation_period(
                    evaluation_period_data, supervisor_user_data
                )
                
                assert period_result["name"] == evaluation_period_data["name"]
                assert period_result["status"] == "active"
                log_database_state("evaluation_period_created", "evaluation_periods", 1)
                
                # Step 2: Set employee goals
                log_integration_step(2, "Set employee goals", {
                    "employee_id": employee_user_data["sub"],
                    "goal_title": goal_data["title"],
                    "goal_weight": goal_data["weight"]
                })
                
                employee_goal = {
                    **goal_data,
                    "employee_id": employee_user_data["sub"],
                    "evaluation_period_id": evaluation_period_data["id"],
                    "assigned_by": supervisor_user_data["sub"]
                }
                mock_goal_instance.create_goal.return_value = employee_goal
                
                goal_result = await mock_goal_instance.create_goal(
                    employee_goal, supervisor_user_data
                )
                
                assert goal_result["employee_id"] == employee_user_data["sub"]
                assert goal_result["weight"] == 0.3
                
                # Step 3: Employee self-assessment
                log_integration_step(3, "Employee self-assessment", {
                    "employee_id": employee_user_data["sub"],
                    "assessment_type": "self_evaluation",
                    "goals_count": 1
                })
                
                self_assessment = {
                    "id": uuid4(),
                    "employee_id": employee_user_data["sub"],
                    "evaluation_period_id": evaluation_period_data["id"],
                    "goal_assessments": [
                        {
                            "goal_id": goal_data["id"],
                            "self_rating": 4,
                            "self_comment": "Made significant progress on project alpha"
                        }
                    ],
                    "overall_self_rating": 4,
                    "submitted_at": datetime.now(),
                    "status": "submitted"
                }
                mock_eval_instance.submit_self_assessment.return_value = self_assessment
                
                assessment_result = await mock_eval_instance.submit_self_assessment(
                    self_assessment, employee_user_data
                )
                
                assert assessment_result["overall_self_rating"] == 4
                assert assessment_result["status"] == "submitted"
                
                # Step 4: Supervisor review
                log_integration_step(4, "Supervisor review", {
                    "supervisor_id": supervisor_user_data["sub"],
                    "employee_id": employee_user_data["sub"],
                    "review_type": "supervisor_evaluation"
                })
                
                supervisor_review = {
                    "id": uuid4(),
                    "employee_id": employee_user_data["sub"],
                    "supervisor_id": supervisor_user_data["sub"],
                    "evaluation_period_id": evaluation_period_data["id"],
                    "goal_reviews": [
                        {
                            "goal_id": goal_data["id"],
                            "supervisor_rating": 4,
                            "supervisor_comment": "Excellent progress, meeting all milestones"
                        }
                    ],
                    "overall_supervisor_rating": 4,
                    "development_feedback": "Continue focusing on project management skills",
                    "submitted_at": datetime.now(),
                    "status": "submitted"
                }
                mock_eval_instance.submit_supervisor_review.return_value = supervisor_review
                
                review_result = await mock_eval_instance.submit_supervisor_review(
                    supervisor_review, supervisor_user_data
                )
                
                assert review_result["overall_supervisor_rating"] == 4
                assert review_result["status"] == "submitted"
                
                # Step 5: Generate final evaluation
                log_integration_step(5, "Generate final evaluation", {
                    "employee_id": employee_user_data["sub"],
                    "self_rating": 4,
                    "supervisor_rating": 4,
                    "final_calculation": "average"
                })
                
                final_evaluation = {
                    "id": uuid4(),
                    "employee_id": employee_user_data["sub"],
                    "evaluation_period_id": evaluation_period_data["id"],
                    "self_assessment_id": self_assessment["id"],
                    "supervisor_review_id": supervisor_review["id"],
                    "final_rating": 4.0,
                    "goal_completion_rate": 0.85,
                    "recommendations": [
                        "Continue current performance level",
                        "Focus on leadership development"
                    ],
                    "next_review_date": (datetime.now() + timedelta(days=90)).date(),
                    "status": "completed"
                }
                mock_eval_instance.generate_final_evaluation.return_value = final_evaluation
                
                final_result = await mock_eval_instance.generate_final_evaluation(
                    employee_user_data["sub"], evaluation_period_data["id"], supervisor_user_data
                )
                
                assert final_result["final_rating"] == 4.0
                assert final_result["status"] == "completed"
                
                # Step 6: Close evaluation period
                log_integration_step(6, "Close evaluation period", {
                    "period_id": str(evaluation_period_data["id"]),
                    "completed_evaluations": 1
                })
                
                closed_period = {
                    **evaluation_period_data,
                    "status": "closed",
                    "completed_evaluations": 1,
                    "closed_at": datetime.now()
                }
                mock_eval_instance.close_evaluation_period.return_value = closed_period
                
                close_result = await mock_eval_instance.close_evaluation_period(
                    evaluation_period_data["id"], supervisor_user_data
                )
                
                assert close_result["status"] == "closed"
                assert close_result["completed_evaluations"] == 1
                
                # Verify complete workflow
                log_workflow_verification("complete_evaluation_cycle", {
                    "evaluation_period_started": True,
                    "goals_set": True,
                    "self_assessment_completed": True,
                    "supervisor_review_completed": True,
                    "final_evaluation_generated": True,
                    "period_closed": True,
                    "data_integrity": True
                })
                
                log_component_integration("EvaluationService", "GoalService", "evaluation_cycle", True)
                log_end_to_end_test("evaluation_cycle", ["EvaluationService", "GoalService", "UserService", "Database"], True)
                log_assertion_success("Complete evaluation cycle workflow successful")
                log_test_summary("complete_evaluation_cycle_workflow", True)
        
        except Exception as e:
            log_error(e, "complete_evaluation_cycle_workflow test")
            log_test_summary("complete_evaluation_cycle_workflow", False, str(e))
            raise

    @pytest.mark.asyncio
    async def test_multi_employee_evaluation_workflow(
        self,
        supervisor_user_data,
        evaluation_period_data
    ):
        """Test evaluation workflow for multiple employees"""
        log_test_start("multi_employee_evaluation_workflow")
        
        try:
            # Mock services
            with patch('app.services.evaluation_service.EvaluationService') as mock_eval_service, \
                 patch('app.services.user_service.UserService') as mock_user_service:
                
                mock_eval_instance = AsyncMock()
                mock_user_instance = AsyncMock()
                mock_eval_service.return_value = mock_eval_instance
                mock_user_service.return_value = mock_user_instance
                
                # Step 1: Setup evaluation period
                log_integration_step(1, "Setup evaluation period for team", {
                    "period_name": evaluation_period_data["name"],
                    "team_size": 3
                })
                
                mock_eval_instance.create_evaluation_period.return_value = evaluation_period_data
                
                period_result = await mock_eval_instance.create_evaluation_period(
                    evaluation_period_data, supervisor_user_data
                )
                
                assert period_result["status"] == "active"
                
                # Step 2: Create multiple employee evaluations
                log_integration_step(2, "Create evaluations for team members", {
                    "evaluation_period_id": str(evaluation_period_data["id"]),
                    "team_members": 3
                })
                
                employees = [
                    {
                        "id": uuid4(),
                        "name": f"Employee {i+1}",
                        "email": f"emp{i+1}@test.com",
                        "employee_code": f"EMP{i+1:03d}"
                    }
                    for i in range(3)
                ]
                
                evaluations = []
                for employee in employees:
                    evaluation = {
                        "id": uuid4(),
                        "employee_id": employee["id"],
                        "evaluation_period_id": evaluation_period_data["id"],
                        "status": "pending",
                        "assigned_supervisor": supervisor_user_data["sub"]
                    }
                    evaluations.append(evaluation)
                
                mock_eval_instance.create_employee_evaluations.return_value = evaluations
                
                eval_results = await mock_eval_instance.create_employee_evaluations(
                    [emp["id"] for emp in employees], evaluation_period_data["id"], supervisor_user_data
                )
                
                assert len(eval_results) == 3
                
                # Step 3: Process bulk evaluations
                log_integration_step(3, "Process bulk evaluations", {
                    "evaluation_count": 3,
                    "processing_method": "batch"
                })
                
                completed_evaluations = []
                for i, evaluation in enumerate(evaluations):
                    completed_eval = {
                        **evaluation,
                        "status": "completed",
                        "final_rating": 3.5 + (i * 0.2),  # Varying ratings
                        "completion_date": datetime.now()
                    }
                    completed_evaluations.append(completed_eval)
                
                mock_eval_instance.process_bulk_evaluations.return_value = completed_evaluations
                
                bulk_results = await mock_eval_instance.process_bulk_evaluations(
                    [eval["id"] for eval in evaluations], supervisor_user_data
                )
                
                assert len(bulk_results) == 3
                assert all(eval["status"] == "completed" for eval in bulk_results)
                
                # Step 4: Generate team performance report
                log_integration_step(4, "Generate team performance report", {
                    "evaluation_period_id": str(evaluation_period_data["id"]),
                    "team_size": 3,
                    "report_type": "team_summary"
                })
                
                team_report = {
                    "evaluation_period_id": evaluation_period_data["id"],
                    "team_size": 3,
                    "completed_evaluations": 3,
                    "average_rating": 3.73,
                    "top_performers": [employees[2]["name"]],
                    "needs_improvement": [],
                    "team_strengths": ["Project delivery", "Collaboration"],
                    "improvement_areas": ["Communication", "Innovation"]
                }
                mock_eval_instance.generate_team_report.return_value = team_report
                
                report_result = await mock_eval_instance.generate_team_report(
                    evaluation_period_data["id"], supervisor_user_data
                )
                
                assert report_result["team_size"] == 3
                assert report_result["completed_evaluations"] == 3
                assert report_result["average_rating"] == 3.73
                
                # Verify workflow completion
                log_workflow_verification("multi_employee_evaluation_complete", {
                    "evaluation_period_setup": True,
                    "bulk_evaluations_created": True,
                    "bulk_processing_completed": True,
                    "team_report_generated": True,
                    "batch_integrity": True
                })
                
                log_component_integration("EvaluationService", "UserService", "bulk_evaluation", True)
                log_end_to_end_test("multi_employee_evaluation", ["EvaluationService", "UserService", "ReportingService"], True)
                log_assertion_success("Multi-employee evaluation workflow successful")
                log_test_summary("multi_employee_evaluation_workflow", True)
        
        except Exception as e:
            log_error(e, "multi_employee_evaluation_workflow test")
            log_test_summary("multi_employee_evaluation_workflow", False, str(e))
            raise

    @pytest.mark.asyncio
    async def test_evaluation_feedback_workflow(
        self,
        supervisor_user_data,
        employee_user_data,
        evaluation_period_data
    ):
        """Test evaluation feedback and discussion workflow"""
        log_test_start("evaluation_feedback_workflow")
        
        try:
            # Mock services
            with patch('app.services.evaluation_service.EvaluationService') as mock_eval_service, \
                 patch('app.services.feedback_service.FeedbackService') as mock_feedback_service:
                
                mock_eval_instance = AsyncMock()
                mock_feedback_instance = AsyncMock()
                mock_eval_service.return_value = mock_eval_instance
                mock_feedback_service.return_value = mock_feedback_instance
                
                # Step 1: Complete evaluation
                log_integration_step(1, "Complete initial evaluation", {
                    "employee_id": employee_user_data["sub"],
                    "evaluation_status": "completed"
                })
                
                evaluation = {
                    "id": uuid4(),
                    "employee_id": employee_user_data["sub"],
                    "evaluation_period_id": evaluation_period_data["id"],
                    "final_rating": 3.5,
                    "status": "completed",
                    "feedback_required": True
                }
                mock_eval_instance.get_evaluation.return_value = evaluation
                
                # Step 2: Submit feedback request
                log_integration_step(2, "Submit feedback request", {
                    "evaluation_id": str(evaluation["id"]),
                    "feedback_type": "development_discussion"
                })
                
                feedback_request = {
                    "id": uuid4(),
                    "evaluation_id": evaluation["id"],
                    "employee_id": employee_user_data["sub"],
                    "supervisor_id": supervisor_user_data["sub"],
                    "feedback_type": "development_discussion",
                    "status": "pending",
                    "requested_at": datetime.now()
                }
                mock_feedback_instance.create_feedback_request.return_value = feedback_request
                
                request_result = await mock_feedback_instance.create_feedback_request(
                    feedback_request, supervisor_user_data
                )
                
                assert request_result["status"] == "pending"
                
                # Step 3: Conduct feedback session
                log_integration_step(3, "Conduct feedback session", {
                    "feedback_id": str(feedback_request["id"]),
                    "session_type": "one_on_one"
                })
                
                feedback_session = {
                    "id": uuid4(),
                    "feedback_request_id": feedback_request["id"],
                    "session_date": datetime.now(),
                    "discussion_points": [
                        "Strengths: Technical skills, problem-solving",
                        "Development areas: Leadership, communication",
                        "Action items: Take on team lead role in next project"
                    ],
                    "employee_feedback": "Appreciate the honest feedback, excited about leadership opportunity",
                    "supervisor_notes": "Employee is receptive to feedback and eager to grow",
                    "follow_up_date": (datetime.now() + timedelta(days=30)).date(),
                    "status": "completed"
                }
                mock_feedback_instance.conduct_feedback_session.return_value = feedback_session
                
                session_result = await mock_feedback_instance.conduct_feedback_session(
                    feedback_session, supervisor_user_data
                )
                
                assert session_result["status"] == "completed"
                assert len(session_result["discussion_points"]) == 3
                
                # Step 4: Create development plan
                log_integration_step(4, "Create development plan", {
                    "employee_id": employee_user_data["sub"],
                    "plan_type": "skill_development"
                })
                
                development_plan = {
                    "id": uuid4(),
                    "employee_id": employee_user_data["sub"],
                    "evaluation_id": evaluation["id"],
                    "feedback_session_id": feedback_session["id"],
                    "development_goals": [
                        {
                            "goal": "Complete leadership training program",
                            "timeline": "3 months",
                            "success_metrics": ["Course completion certificate", "360 feedback improvement"]
                        },
                        {
                            "goal": "Lead a cross-functional project",
                            "timeline": "6 months",
                            "success_metrics": ["Project delivery on time", "Team satisfaction score > 4.0"]
                        }
                    ],
                    "review_schedule": [
                        {"date": (datetime.now() + timedelta(days=30)).date(), "type": "progress_check"},
                        {"date": (datetime.now() + timedelta(days=90)).date(), "type": "formal_review"}
                    ],
                    "status": "active"
                }
                mock_feedback_instance.create_development_plan.return_value = development_plan
                
                plan_result = await mock_feedback_instance.create_development_plan(
                    development_plan, supervisor_user_data
                )
                
                assert plan_result["status"] == "active"
                assert len(plan_result["development_goals"]) == 2
                
                # Verify workflow completion
                log_workflow_verification("evaluation_feedback_complete", {
                    "evaluation_completed": True,
                    "feedback_requested": True,
                    "feedback_session_conducted": True,
                    "development_plan_created": True,
                    "continuous_improvement_cycle": True
                })
                
                log_component_integration("EvaluationService", "FeedbackService", "feedback_cycle", True)
                log_end_to_end_test("evaluation_feedback", ["EvaluationService", "FeedbackService", "DevelopmentService"], True)
                log_assertion_success("Evaluation feedback workflow successful")
                log_test_summary("evaluation_feedback_workflow", True)
        
        except Exception as e:
            log_error(e, "evaluation_feedback_workflow test")
            log_test_summary("evaluation_feedback_workflow", False, str(e))
            raise 