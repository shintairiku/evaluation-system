import asyncio
from app.database.session import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("SELECT u.id, u.full_name FROM users u WHERE u.email = 'shiruba.global@gmail.com'"))
        user = result.fetchone()
        if not user:
            print("User not found")
            return
        print(f"User: {user.full_name} (id={user.id})")
        
        result = await session.execute(text("""
            SELECT pra.id, u_reviewee.full_name as reviewee_name, 
                   pre.status as eval_status, ep.name as period_name
            FROM peer_review_assignments pra
            JOIN users u_reviewee ON u_reviewee.id = pra.reviewee_id
            LEFT JOIN peer_review_evaluations pre ON pre.assignment_id = pra.id
            JOIN evaluation_periods ep ON ep.id = pra.evaluation_period_id
            WHERE pra.reviewer_id = :uid
            ORDER BY pra.evaluation_period_id
        """), {"uid": str(user.id)})
        rows = result.fetchall()
        print(f"Assignments: {len(rows)}")
        for r in rows:
            print(f"  Reviewee: {r.reviewee_name}, Period: {r.period_name}, Status: {r.eval_status}")

asyncio.run(check())
