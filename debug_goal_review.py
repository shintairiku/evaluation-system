#!/usr/bin/env python3
"""
Debug script to investigate why new goals are not appearing in Goal Review page.
This script will help identify the issue with supervisor_review creation.
"""

import asyncio
import sys
import os
from uuid import UUID

# Add the backend directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.database.session import get_db_session
from backend.app.database.repositories.goal_repo import GoalRepository
from backend.app.database.repositories.user_repo import UserRepository
from backend.app.database.repositories.supervisor_review_repository import SupervisorReviewRepository
from backend.app.database.models.goal import Goal
from backend.app.database.models.user import User, UserSupervisor
from sqlalchemy import select, and_

async def debug_goal_review_issue():
    """Debug the goal review issue by checking data flow."""
    
    async with get_db_session() as session:
        goal_repo = GoalRepository(session)
        user_repo = UserRepository(session)
        supervisor_review_repo = SupervisorReviewRepository(session)
        
        print("🔍 Debugging Goal Review Issue")
        print("=" * 50)
        
        # 1. Check if there are any goals with status 'submitted'
        print("\n1. Checking goals with status 'submitted':")
        submitted_goals_query = select(Goal).filter(Goal.status == 'submitted')
        submitted_goals_result = await session.execute(submitted_goals_query)
        submitted_goals = submitted_goals_result.scalars().all()
        
        print(f"   Found {len(submitted_goals)} goals with status 'submitted'")
        for goal in submitted_goals:
            print(f"   - Goal ID: {goal.id}, User ID: {goal.user_id}, Period ID: {goal.period_id}")
        
        # 2. Check supervisor-subordinate relationships
        print("\n2. Checking supervisor-subordinate relationships:")
        if submitted_goals:
            for goal in submitted_goals:
                print(f"\n   For Goal {goal.id} (User {goal.user_id}):")
                try:
                    supervisors = await user_repo.get_user_supervisors(goal.user_id, goal.org_id)
                    print(f"   Found {len(supervisors)} supervisors:")
                    for supervisor in supervisors:
                        print(f"   - Supervisor ID: {supervisor.id}, Name: {supervisor.name}")
                except Exception as e:
                    print(f"   Error getting supervisors: {e}")
        
        # 3. Check supervisor_review records
        print("\n3. Checking supervisor_review records:")
        supervisor_reviews_query = select(supervisor_review_repo.model)
        supervisor_reviews_result = await session.execute(supervisor_reviews_query)
        supervisor_reviews = supervisor_reviews_result.scalars().all()
        
        print(f"   Found {len(supervisor_reviews)} supervisor_review records:")
        for review in supervisor_reviews:
            print(f"   - Review ID: {review.id}, Goal ID: {review.goal_id}, Supervisor ID: {review.supervisor_id}, Status: {review.status}")
        
        # 4. Check pending reviews specifically
        print("\n4. Checking pending reviews (status='draft'):")
        pending_reviews_query = select(supervisor_review_repo.model).filter(
            supervisor_review_repo.model.status == 'draft'
        )
        pending_reviews_result = await session.execute(pending_reviews_query)
        pending_reviews = pending_reviews_result.scalars().all()
        
        print(f"   Found {len(pending_reviews)} pending reviews:")
        for review in pending_reviews:
            print(f"   - Review ID: {review.id}, Goal ID: {review.goal_id}, Supervisor ID: {review.supervisor_id}")
        
        # 5. Check user-supervisor relationships
        print("\n5. Checking user-supervisor relationships:")
        user_supervisor_query = select(UserSupervisor)
        user_supervisor_result = await session.execute(user_supervisor_query)
        user_supervisor_relations = user_supervisor_result.scalars().all()
        
        print(f"   Found {len(user_supervisor_relations)} user-supervisor relationships:")
        for relation in user_supervisor_relations:
            print(f"   - User ID: {relation.user_id}, Supervisor ID: {relation.supervisor_id}")
        
        # 6. Check if there are any users with supervisor roles
        print("\n6. Checking users with supervisor roles:")
        try:
            # This would need to be implemented based on your role system
            print("   (Role checking not implemented in this debug script)")
        except Exception as e:
            print(f"   Error checking roles: {e}")
        
        print("\n" + "=" * 50)
        print("Debug completed!")

if __name__ == "__main__":
    asyncio.run(debug_goal_review_issue())
