<!-- BEGIN GENERATED:main -->
# Milestones and Tasks — {{PROJECT_NAME}}

This page is a **Database (Grid)** — layout `1` — not a static document. Records all share
one table and are distinguished by the **Type** field (Milestone or Task).

## Schema

| Field | Values / notes |
|-------|----------------|
| Type | Milestone / Task |
| Title | Short description |
| Status | To Do / In Progress / Done (default: To Do) |
| Owner | Assigned person (default: space owner) |
| Due Date | Date |
| Priority | Low / Medium / High / Urgent |
| Link to Project/Space | Relation to this project |
| Description/Notes | Details |
| Recurring | Yes / No |
| Estimate (hours) | Number |
| Tags | Free-form labels |

## Conventions

- Milestones are coarse phase goals; Tasks are concrete work items under them.
- A Task is linked to its parent Milestone via the Description/Notes or Tags.
- A record is "Done" only when its work is verified complete.
<!-- END GENERATED:main -->
