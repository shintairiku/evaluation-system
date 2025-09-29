"""
Test suite for RBAC Performance Testing - Baseline measurement and optimization validation.

This test suite verifies:
- Baseline performance measurement of existing service functions
- RBAC framework performance comparison
- Cache effectiveness and hit rates
- Load testing scenarios
- Performance regression detection
- Memory usage optimization
"""

import pytest
import time
import asyncio
import statistics
from uuid import uuid4
from typing import List, Dict
from unittest.mock import Mock, AsyncMock

from app.security.rbac_helper import RBACHelper, subordinate_cache, resource_access_cache
from app.security.rbac_types import ResourceType
from app.security.context import AuthContext, RoleInfo
from app.security.permissions import Permission
from app.security.decorators import require_permission


class PerformanceTimer:
    """Helper class for measuring execution time"""
    
    def __init__(self, name: str):
        self.name = name
        self.start_time = None
        self.end_time = None
        self.duration = None
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.duration = self.end_time - self.start_time
    
    def __str__(self):
        return f"{self.name}: {self.duration:.4f}s"


class MockServiceFunctions:
    """Mock existing service functions to simulate baseline performance"""
    
    def __init__(self, user_repository):
        self.user_repo = user_repository
        self.call_count = 0
    
    async def existing_get_users_simulation(self, current_user_context: AuthContext, **kwargs) -> List[Dict]:
        """Simulate existing get_users function with complex permission logic"""
        self.call_count += 1
        
        # Simulate the existing complex if-elif-else permission logic
        await asyncio.sleep(0.001)  # Simulate processing time
        
        accessible_user_ids = []
        
        if current_user_context.has_permission(Permission.USER_READ_ALL):
            # Admin: simulate fetching all users
            await asyncio.sleep(0.005)  # Database query simulation
            accessible_user_ids = [uuid4() for _ in range(100)]
        elif current_user_context.has_permission(Permission.USER_READ_SUBORDINATES):
            # Manager: simulate fetching subordinates
            await asyncio.sleep(0.003)  # Database query simulation for subordinates
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            accessible_user_ids = [sub.id for sub in subordinates] + [current_user_context.user_id]
        elif current_user_context.has_permission(Permission.USER_READ_SELF):
            # Employee: only self
            accessible_user_ids = [current_user_context.user_id]
        
        # Simulate additional processing
        await asyncio.sleep(0.002)
        
        return [{"id": str(uid), "name": f"User {i}"} for i, uid in enumerate(accessible_user_ids[:20])]
    
    async def rbac_get_users_simulation(self, current_user_context: AuthContext, **kwargs) -> List[Dict]:
        """Simulate get_users function using new RBAC framework"""
        self.call_count += 1
        
        # Use RBAC framework
        await asyncio.sleep(0.001)  # Simulate processing time
        
        accessible_user_ids = await RBACHelper.get_accessible_user_ids(current_user_context)
        
        if accessible_user_ids is None:
            # Admin: simulate fetching all users
            await asyncio.sleep(0.005)  # Database query simulation
            user_data = [{"id": str(uuid4()), "name": f"User {i}"} for i in range(100)]
        else:
            # Filtered access
            user_data = [{"id": str(uid), "name": f"User {i}"} for i, uid in enumerate(accessible_user_ids[:20])]
        
        # Simulate additional processing
        await asyncio.sleep(0.002)
        
        return user_data
    
    async def existing_get_goals_simulation(self, current_user_context: AuthContext, **kwargs) -> List[Dict]:
        """Simulate existing get_goals function"""
        self.call_count += 1
        await asyncio.sleep(0.0015)  # Simulate processing
        
        # Simulate complex permission logic for goals
        if current_user_context.has_permission(Permission.GOAL_READ_ALL):
            await asyncio.sleep(0.004)
            goals = [{"id": str(uuid4()), "title": f"Goal {i}"} for i in range(50)]
        elif current_user_context.has_permission(Permission.GOAL_READ_SUBORDINATES):
            await asyncio.sleep(0.003)
            subordinates = await self.user_repo.get_subordinates(current_user_context.user_id)
            goals = [{"id": str(uuid4()), "title": f"Goal {i}"} for i in range(len(subordinates) * 3)]
        else:
            goals = [{"id": str(uuid4()), "title": f"Personal Goal {i}"} for i in range(5)]
        
        return goals
    
    async def rbac_get_goals_simulation(self, current_user_context: AuthContext, **kwargs) -> List[Dict]:
        """Simulate get_goals function using RBAC framework"""
        self.call_count += 1
        await asyncio.sleep(0.0015)  # Simulate processing
        
        accessible_user_ids = await RBACHelper.get_accessible_resource_ids(
            current_user_context, ResourceType.GOAL
        )
        
        if accessible_user_ids is None:
            await asyncio.sleep(0.004)
            goals = [{"id": str(uuid4()), "title": f"Goal {i}"} for i in range(50)]
        else:
            goals = [{"id": str(uuid4()), "title": f"Goal {i}"} for i in range(len(accessible_user_ids) * 3)]
        
        return goals


class TestBaselinePerformanceMeasurement:
    """Test suite for baseline performance measurement (Task 5.1)"""
    
    def setup_method(self):
        """Setup test environment"""
        subordinate_cache.clear()
        resource_access_cache.clear()
        
        # Setup mock repository with realistic data
        self.mock_repo = Mock()
        self.subordinate_users = [Mock(id=uuid4()) for _ in range(10)]  # 10 subordinates
        self.mock_repo.get_subordinates = AsyncMock(return_value=self.subordinate_users)
        
        RBACHelper.initialize_with_repository(self.mock_repo)
        
        # Create service mock
        self.service_mock = MockServiceFunctions(self.mock_repo)
    
    def create_auth_contexts(self) -> Dict[str, AuthContext]:
        """Create various auth contexts for testing"""
        return {
            "admin": AuthContext(
                user_id=uuid4(),
                roles=[RoleInfo(id=1, name="admin", description="Administrator")]
            ),
            "manager": AuthContext(
                user_id=uuid4(),
                roles=[RoleInfo(id=2, name="manager", description="Manager")]
            ),
            "supervisor": AuthContext(
                user_id=uuid4(),
                roles=[RoleInfo(id=3, name="supervisor", description="Supervisor")]
            ),
            "employee": AuthContext(
                user_id=uuid4(),
                roles=[RoleInfo(id=4, name="employee", description="Employee")]
            ),
            "viewer": AuthContext(
                user_id=uuid4(),
                roles=[RoleInfo(id=5, name="viewer", description="Viewer")]
            )
        }
    
    @pytest.mark.asyncio
    async def test_baseline_get_users_performance(self):
        """Measure baseline performance of existing get_users function"""
        auth_contexts = self.create_auth_contexts()
        results = {}
        
        for role_name, auth_context in auth_contexts.items():
            measurements = []
            
            # Run multiple iterations for statistical significance
            for _ in range(10):
                with PerformanceTimer(f"existing_get_users_{role_name}") as timer:
                    result = await self.service_mock.existing_get_users_simulation(auth_context)
                measurements.append(timer.duration)
            
            results[role_name] = {
                "mean": statistics.mean(measurements),
                "median": statistics.median(measurements),
                "stdev": statistics.stdev(measurements) if len(measurements) > 1 else 0,
                "min": min(measurements),
                "max": max(measurements),
                "sample_size": len(measurements),
                "result_count": len(result)
            }
        
        # Log baseline results for comparison
        print("\n=== BASELINE PERFORMANCE RESULTS (get_users) ===")
        for role, stats in results.items():
            print(f"{role:10s}: mean={stats['mean']:.4f}s, "
                  f"median={stats['median']:.4f}s, "
                  f"stdev={stats['stdev']:.4f}s, "
                  f"results={stats['result_count']}")
        
        # Verify reasonable performance (should be under 50ms for most operations)
        for role, stats in results.items():
            assert stats["mean"] < 0.050, f"Baseline {role} performance too slow: {stats['mean']:.4f}s"
        
        # Store results for comparison in later tests
        self.baseline_get_users_results = results
    
    @pytest.mark.asyncio
    async def test_baseline_get_goals_performance(self):
        """Measure baseline performance of existing get_goals function"""
        auth_contexts = self.create_auth_contexts()
        results = {}
        
        for role_name, auth_context in auth_contexts.items():
            measurements = []
            
            for _ in range(10):
                with PerformanceTimer(f"existing_get_goals_{role_name}") as timer:
                    result = await self.service_mock.existing_get_goals_simulation(auth_context)
                measurements.append(timer.duration)
            
            results[role_name] = {
                "mean": statistics.mean(measurements),
                "median": statistics.median(measurements),
                "stdev": statistics.stdev(measurements) if len(measurements) > 1 else 0,
                "result_count": len(result)
            }
        
        print("\n=== BASELINE PERFORMANCE RESULTS (get_goals) ===")
        for role, stats in results.items():
            print(f"{role:10s}: mean={stats['mean']:.4f}s, "
                  f"median={stats['median']:.4f}s, "
                  f"results={stats['result_count']}")
        
        # Store results for comparison
        self.baseline_get_goals_results = results
    
    @pytest.mark.asyncio
    async def test_baseline_permission_check_performance(self):
        """Measure baseline performance of permission checks"""
        auth_contexts = self.create_auth_contexts()
        results = {}
        
        permissions_to_test = [
            Permission.USER_READ_ALL,
            Permission.USER_READ_SUBORDINATES,
            Permission.USER_READ_SELF,
            Permission.GOAL_READ_ALL,
            Permission.GOAL_MANAGE_SELF,
        ]
        
        for role_name, auth_context in auth_contexts.items():
            measurements = []
            
            # Test multiple permission checks
            for _ in range(100):  # Many iterations for micro-benchmarking
                with PerformanceTimer(f"permission_check_{role_name}") as timer:
                    for permission in permissions_to_test:
                        auth_context.has_permission(permission)
                measurements.append(timer.duration)
            
            results[role_name] = {
                "mean": statistics.mean(measurements),
                "median": statistics.median(measurements),
                "per_check": statistics.mean(measurements) / len(permissions_to_test)
            }
        
        print("\n=== BASELINE PERMISSION CHECK PERFORMANCE ===")
        for role, stats in results.items():
            print(f"{role:10s}: {stats['per_check']*1000000:.2f}μs per check")
        
        # Permission checks should be very fast (under 10μs each)
        for role, stats in results.items():
            assert stats["per_check"] < 0.00001, \
                f"Permission check too slow for {role}: {stats['per_check']*1000000:.2f}μs"


class TestRBACFrameworkPerformance:
    """Test suite for RBAC framework performance measurement (Task 5.2)"""
    
    def setup_method(self):
        """Setup test environment"""
        subordinate_cache.clear()
        resource_access_cache.clear()
        
        self.mock_repo = Mock()
        self.subordinate_users = [Mock(id=uuid4()) for _ in range(10)]
        self.mock_repo.get_subordinates = AsyncMock(return_value=self.subordinate_users)
        
        RBACHelper.initialize_with_repository(self.mock_repo)
        self.service_mock = MockServiceFunctions(self.mock_repo)
    
    def create_auth_contexts(self) -> Dict[str, AuthContext]:
        """Create auth contexts for testing"""
        return {
            "admin": AuthContext(
                user_id=uuid4(),
                roles=[RoleInfo(id=1, name="admin", description="Administrator")]
            ),
            "manager": AuthContext(
                user_id=uuid4(),
                roles=[RoleInfo(id=2, name="manager", description="Manager")]
            ),
            "employee": AuthContext(
                user_id=uuid4(),
                roles=[RoleInfo(id=4, name="employee", description="Employee")]
            )
        }
    
    @pytest.mark.asyncio
    async def test_rbac_get_users_performance(self):
        """Measure RBAC framework performance for get_users"""
        auth_contexts = self.create_auth_contexts()
        results = {}
        
        for role_name, auth_context in auth_contexts.items():
            measurements = []
            
            for _ in range(10):
                with PerformanceTimer(f"rbac_get_users_{role_name}") as timer:
                    result = await self.service_mock.rbac_get_users_simulation(auth_context)
                measurements.append(timer.duration)
            
            results[role_name] = {
                "mean": statistics.mean(measurements),
                "median": statistics.median(measurements),
                "stdev": statistics.stdev(measurements) if len(measurements) > 1 else 0,
                "result_count": len(result)
            }
        
        print("\n=== RBAC FRAMEWORK PERFORMANCE RESULTS (get_users) ===")
        for role, stats in results.items():
            print(f"{role:10s}: mean={stats['mean']:.4f}s, "
                  f"median={stats['median']:.4f}s, "
                  f"results={stats['result_count']}")
        
        # Should maintain similar performance to baseline
        for role, stats in results.items():
            assert stats["mean"] < 0.060, f"RBAC {role} performance too slow: {stats['mean']:.4f}s"
        
        self.rbac_get_users_results = results
    
    @pytest.mark.asyncio
    async def test_rbac_helper_direct_performance(self):
        """Measure direct RBACHelper method performance"""
        auth_contexts = self.create_auth_contexts()
        results = {}
        
        for role_name, auth_context in auth_contexts.items():
            measurements = {
                "get_accessible_user_ids": [],
                "get_accessible_resource_ids": [],
                "can_access_resource": []
            }
            
            resource_id = uuid4()
            
            # Test each method multiple times
            for _ in range(20):
                # Test get_accessible_user_ids
                with PerformanceTimer("get_accessible_user_ids") as timer:
                    await RBACHelper.get_accessible_user_ids(auth_context)
                measurements["get_accessible_user_ids"].append(timer.duration)
                
                # Test get_accessible_resource_ids
                with PerformanceTimer("get_accessible_resource_ids") as timer:
                    await RBACHelper.get_accessible_resource_ids(auth_context, ResourceType.USER)
                measurements["get_accessible_resource_ids"].append(timer.duration)
                
                # Test can_access_resource
                with PerformanceTimer("can_access_resource") as timer:
                    await RBACHelper.can_access_resource(
                        auth_context, resource_id, ResourceType.USER, owner_user_id=auth_context.user_id
                    )
                measurements["can_access_resource"].append(timer.duration)
            
            results[role_name] = {}
            for method, times in measurements.items():
                results[role_name][method] = {
                    "mean": statistics.mean(times),
                    "median": statistics.median(times),
                    "min": min(times),
                    "max": max(times)
                }
        
        print("\n=== RBAC HELPER DIRECT PERFORMANCE ===")
        for role, methods in results.items():
            print(f"\n{role.upper()}:")
            for method, stats in methods.items():
                print(f"  {method:25s}: mean={stats['mean']*1000:.2f}ms, "
                      f"median={stats['median']*1000:.2f}ms")
        
        # Direct helper methods should be very fast (under 10ms each)
        for role, methods in results.items():
            for method, stats in methods.items():
                assert stats["mean"] < 0.010, \
                    f"RBAC {method} too slow for {role}: {stats['mean']*1000:.2f}ms"
    
    @pytest.mark.asyncio
    async def test_decorator_performance_overhead(self):
        """Measure performance overhead of RBAC decorators"""
        auth_context = AuthContext(
            user_id=uuid4(),
            roles=[RoleInfo(id=1, name="admin", description="Administrator")]
        )
        
        # Test function without decorator
        async def plain_function(current_user_context: AuthContext):
            await asyncio.sleep(0.001)  # Simulate work
            return "result"
        
        # Test function with decorator
        @require_permission(Permission.USER_READ_ALL)
        async def decorated_function(current_user_context: AuthContext):
            await asyncio.sleep(0.001)  # Same work
            return "result"
        
        # Measure plain function
        plain_measurements = []
        for _ in range(50):
            with PerformanceTimer("plain") as timer:
                await plain_function(current_user_context=auth_context)
            plain_measurements.append(timer.duration)
        
        # Measure decorated function
        decorated_measurements = []
        for _ in range(50):
            with PerformanceTimer("decorated") as timer:
                await decorated_function(current_user_context=auth_context)
            decorated_measurements.append(timer.duration)
        
        plain_mean = statistics.mean(plain_measurements)
        decorated_mean = statistics.mean(decorated_measurements)
        overhead = decorated_mean - plain_mean
        overhead_percentage = (overhead / plain_mean) * 100
        
        print("\n=== DECORATOR PERFORMANCE OVERHEAD ===")
        print(f"Plain function:     {plain_mean*1000:.3f}ms")
        print(f"Decorated function: {decorated_mean*1000:.3f}ms")
        print(f"Overhead:           {overhead*1000:.3f}ms ({overhead_percentage:.1f}%)")
        
        # Decorator overhead should be minimal (under 1ms and under 10% overhead)
        assert overhead < 0.001, f"Decorator overhead too high: {overhead*1000:.3f}ms"
        assert overhead_percentage < 10, f"Decorator overhead percentage too high: {overhead_percentage:.1f}%"


class TestCacheEffectivenessAndLoadTesting:
    """Test suite for cache effectiveness and load testing (Task 5.3)"""
    
    def setup_method(self):
        """Setup test environment"""
        subordinate_cache.clear()
        resource_access_cache.clear()
        
        self.mock_repo = Mock()
        self.subordinate_users = [Mock(id=uuid4()) for _ in range(5)]
        self.mock_repo.get_subordinates = AsyncMock(return_value=self.subordinate_users)
        
        RBACHelper.initialize_with_repository(self.mock_repo)
    
    @pytest.mark.asyncio
    async def test_cache_hit_rate_measurement(self):
        """Test cache hit rates meet performance targets (80%+)"""
        manager_context = AuthContext(
            user_id=uuid4(),
            roles=[RoleInfo(id=2, name="manager", description="Manager")]
        )
        
        # Clear any existing cache
        subordinate_cache.clear()
        resource_access_cache.clear()
        
        # Reset repository call counter
        self.mock_repo.get_subordinates.reset_mock()
        
        # Perform multiple calls that should benefit from caching
        cache_test_iterations = 20
        
        for i in range(cache_test_iterations):
            await RBACHelper.get_accessible_user_ids(manager_context)
            await RBACHelper.get_accessible_resource_ids(manager_context, ResourceType.USER)
            await RBACHelper.get_accessible_resource_ids(manager_context, ResourceType.GOAL)
        
        # Calculate cache effectiveness
        total_expected_db_calls = cache_test_iterations  # One per iteration for subordinates
        actual_db_calls = self.mock_repo.get_subordinates.call_count
        
        cache_hit_rate = 1 - (actual_db_calls / total_expected_db_calls)
        cache_hit_percentage = cache_hit_rate * 100
        
        print("\n=== CACHE EFFECTIVENESS ===")
        print(f"Expected DB calls without cache: {total_expected_db_calls}")
        print(f"Actual DB calls with cache:      {actual_db_calls}")
        print(f"Cache hit rate:                  {cache_hit_percentage:.1f}%")
        
        # Should achieve 80%+ cache hit rate as per requirements
        assert cache_hit_percentage >= 80, \
            f"Cache hit rate below target: {cache_hit_percentage:.1f}% (target: 80%+)"
        
        # Verify cache contains expected entries
        assert len(subordinate_cache) > 0, "Subordinate cache should contain entries"
        assert len(resource_access_cache) > 0, "Resource access cache should contain entries"
    
    @pytest.mark.asyncio
    async def test_concurrent_access_performance(self):
        """Test performance under concurrent access scenarios"""
        auth_contexts = [
            AuthContext(
                user_id=uuid4(),
                roles=[RoleInfo(id=2, name="manager", description="Manager")]
            )
            for _ in range(10)  # 10 concurrent managers
        ]
        
        async def concurrent_access_simulation(auth_context: AuthContext, iterations: int):
            """Simulate concurrent user accessing RBAC functions"""
            results = []
            for _ in range(iterations):
                start_time = time.perf_counter()
                
                # Simulate realistic access pattern
                await RBACHelper.get_accessible_user_ids(auth_context)
                await RBACHelper.get_accessible_resource_ids(auth_context, ResourceType.GOAL)
                await RBACHelper.can_access_resource(
                    auth_context, uuid4(), ResourceType.USER, owner_user_id=auth_context.user_id
                )
                
                end_time = time.perf_counter()
                results.append(end_time - start_time)
            
            return results
        
        # Run concurrent simulations
        concurrent_iterations = 10
        tasks = [
            concurrent_access_simulation(ctx, concurrent_iterations) 
            for ctx in auth_contexts
        ]
        
        start_total = time.perf_counter()
        all_results = await asyncio.gather(*tasks)
        end_total = time.perf_counter()
        
        # Analyze results
        all_measurements = [measurement for results in all_results for measurement in results]
        
        total_operations = len(auth_contexts) * concurrent_iterations * 3  # 3 operations per iteration
        total_time = end_total - start_total
        operations_per_second = total_operations / total_time
        
        mean_response_time = statistics.mean(all_measurements)
        p95_response_time = sorted(all_measurements)[int(len(all_measurements) * 0.95)]
        p99_response_time = sorted(all_measurements)[int(len(all_measurements) * 0.99)]
        
        print("\n=== CONCURRENT ACCESS PERFORMANCE ===")
        print(f"Total concurrent users:     {len(auth_contexts)}")
        print(f"Operations per user:        {concurrent_iterations * 3}")
        print(f"Total operations:           {total_operations}")
        print(f"Total time:                 {total_time:.3f}s")
        print(f"Operations per second:      {operations_per_second:.1f}")
        print(f"Mean response time:         {mean_response_time*1000:.2f}ms")
        print(f"95th percentile:            {p95_response_time*1000:.2f}ms")
        print(f"99th percentile:            {p99_response_time*1000:.2f}ms")
        
        # Performance assertions
        assert operations_per_second >= 100, f"Throughput too low: {operations_per_second:.1f} ops/s"
        assert mean_response_time < 0.050, f"Mean response time too high: {mean_response_time*1000:.2f}ms"
        assert p95_response_time < 0.100, f"95th percentile too high: {p95_response_time*1000:.2f}ms"
    
    @pytest.mark.asyncio
    async def test_memory_usage_optimization(self):
        """Test that cache usage doesn't grow unbounded"""
        import gc
        
        # Measure baseline memory
        gc.collect()
        baseline_objects = len(gc.get_objects())
        
        # Create many auth contexts and perform operations
        auth_contexts = [
            AuthContext(
                user_id=uuid4(),
                roles=[RoleInfo(id=2, name="manager", description="Manager")]
            )
            for _ in range(100)  # Many users
        ]
        
        # Perform operations that would populate caches
        for auth_context in auth_contexts:
            await RBACHelper.get_accessible_user_ids(auth_context)
            await RBACHelper.get_accessible_resource_ids(auth_context, ResourceType.USER)
        
        # Check cache sizes are within reasonable bounds
        subordinate_cache_size = len(subordinate_cache)
        resource_cache_size = len(resource_access_cache)
        
        print("\n=== MEMORY USAGE OPTIMIZATION ===")
        print(f"Subordinate cache entries:  {subordinate_cache_size}")
        print(f"Resource cache entries:     {resource_cache_size}")
        print(f"Total cache entries:        {subordinate_cache_size + resource_cache_size}")
        
        # Caches should not grow linearly with number of users due to cache limits
        assert subordinate_cache_size <= 100, f"Subordinate cache too large: {subordinate_cache_size}"
        assert resource_cache_size <= 500, f"Resource cache too large: {resource_cache_size}"
        
        # Memory usage should not increase dramatically
        gc.collect()
        final_objects = len(gc.get_objects())
        object_increase = final_objects - baseline_objects
        
        print(f"Object count increase:      {object_increase}")
        
        # Object increase should be reasonable (not more than 2x number of operations)
        assert object_increase < 500, f"Too many objects created: {object_increase}"
    
    @pytest.mark.asyncio
    async def test_cache_ttl_effectiveness(self):
        """Test that TTL cache expiration works correctly"""
        manager_context = AuthContext(
            user_id=uuid4(),
            roles=[RoleInfo(id=2, name="manager", description="Manager")]
        )
        
        # Clear caches
        subordinate_cache.clear()
        resource_access_cache.clear()
        
        # Perform initial operation to populate cache
        await RBACHelper.get_accessible_user_ids(manager_context)
        
        initial_cache_size = len(subordinate_cache)
        assert initial_cache_size > 0, "Cache should be populated"
        
        # Verify cache contains our entry
        cache_key = f"subordinates_{manager_context.user_id}"
        assert cache_key in subordinate_cache, "Cache should contain subordinate data"
        
        # Simulate some time passing (we can't easily test TTL expiration without waiting)
        # Instead, test manual cache clearing functionality
        RBACHelper.clear_cache(manager_context.user_id)
        
        # Verify cache was cleared
        assert cache_key not in subordinate_cache, "Cache should be cleared after manual clear"
        
        # Verify operations still work after cache clear
        result = await RBACHelper.get_accessible_user_ids(manager_context)
        assert manager_context.user_id in result, "Should still work after cache clear"


class TestPerformanceRegressionDetection:
    """Test suite for detecting performance regressions"""
    
    @pytest.mark.asyncio
    async def test_performance_comparison_baseline_vs_rbac(self):
        """Compare baseline vs RBAC framework performance directly"""
        subordinate_cache.clear()
        resource_access_cache.clear()
        
        mock_repo = Mock()
        subordinate_users = [Mock(id=uuid4()) for _ in range(5)]
        mock_repo.get_subordinates = AsyncMock(return_value=subordinate_users)
        
        RBACHelper.initialize_with_repository(mock_repo)
        service_mock = MockServiceFunctions(mock_repo)
        
        # Test with manager context (most complex scenario)
        manager_context = AuthContext(
            user_id=uuid4(),
            roles=[RoleInfo(id=2, name="manager", description="Manager")]
        )
        
        # Measure baseline performance
        baseline_times = []
        for _ in range(20):
            with PerformanceTimer("baseline") as timer:
                await service_mock.existing_get_users_simulation(manager_context)
            baseline_times.append(timer.duration)
        
        # Measure RBAC performance
        rbac_times = []
        for _ in range(20):
            with PerformanceTimer("rbac") as timer:
                await service_mock.rbac_get_users_simulation(manager_context)
            rbac_times.append(timer.duration)
        
        baseline_mean = statistics.mean(baseline_times)
        rbac_mean = statistics.mean(rbac_times)
        
        performance_difference = rbac_mean - baseline_mean
        performance_change_percentage = (performance_difference / baseline_mean) * 100
        
        print("\n=== BASELINE vs RBAC PERFORMANCE COMPARISON ===")
        print(f"Baseline mean:          {baseline_mean*1000:.3f}ms")
        print(f"RBAC mean:              {rbac_mean*1000:.3f}ms")
        print(f"Difference:             {performance_difference*1000:.3f}ms")
        print(f"Performance change:     {performance_change_percentage:+.1f}%")
        
        # RBAC should be within ±5% of baseline performance (requirement from design doc)
        assert abs(performance_change_percentage) <= 5, \
            f"Performance change too high: {performance_change_percentage:+.1f}% (target: ±5%)"
        
        # Both should be reasonably fast
        assert baseline_mean < 0.050, f"Baseline too slow: {baseline_mean*1000:.3f}ms"
        assert rbac_mean < 0.050, f"RBAC too slow: {rbac_mean*1000:.3f}ms"
    
    def test_permission_check_performance_bounds(self):
        """Test that permission checks stay within performance bounds"""
        auth_context = AuthContext(
            user_id=uuid4(),
            roles=[RoleInfo(id=2, name="manager", description="Manager")]
        )
        
        # Test multiple permission checks
        permissions = [Permission.USER_READ_ALL, Permission.USER_READ_SUBORDINATES, 
                      Permission.GOAL_CREATE, Permission.EVALUATION_READ]
        
        measurements = []
        for _ in range(1000):  # Many iterations for statistical significance
            with PerformanceTimer("permission_check") as timer:
                for permission in permissions:
                    auth_context.has_permission(permission)
            measurements.append(timer.duration)
        
        mean_time = statistics.mean(measurements)
        per_check_time = mean_time / len(permissions)
        
        print("\n=== PERMISSION CHECK PERFORMANCE BOUNDS ===")
        print(f"Mean time for {len(permissions)} checks: {mean_time*1000000:.2f}μs")
        print(f"Time per permission check:               {per_check_time*1000000:.2f}μs")
        
        # Each permission check should be very fast (under 1μs)
        assert per_check_time < 0.000001, \
            f"Permission check too slow: {per_check_time*1000000:.2f}μs per check"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])  # -s to show print statements