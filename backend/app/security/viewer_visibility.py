from enum import Enum


class ViewerSubjectType(str, Enum):
    USER = "user"
    DEPARTMENT = "department"
    SUPERVISOR_TEAM = "supervisor_team"
