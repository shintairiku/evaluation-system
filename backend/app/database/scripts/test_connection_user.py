from prisma import Prisma
import asyncio

async def main():
    db = Prisma()
    await db.connect()
    
    users = await db.user.find_many()
    print("Total users:", len(users))
    
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
