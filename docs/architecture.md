# EcoTrack Architecture

## Main Style

EcoTrack uses a modular monolithic backend.

The main backend modules will include:

```text
auth
organizations
users
incidents
tasks
volunteers
workflows
notifications
analytics
audit

Module Organization

Simple operations use:

controllers/
services/
repositories/
schemas/

Complex operations use:

use-cases/

Example:

tasks/
├── tasks.routes.ts
├── controllers/
├── services/
├── repositories/
├── schemas/
├── use-cases/
├── tasks.types.ts
└── tasks.constants.ts
Heavy Processing

Slow, retryable, or bulk work will use Redis queues and separate worker processes.

Examples:

Push notification delivery
Image processing
PDF and CSV exports
Analytics recalculation
Scheduled reminders

Workers do not normally require public HTTP ports.

## Push Notification Delivery

The mobile app registers an authenticated installation and Expo push token through the notifications API. Creating a permanent notification also creates one durable `notification_deliveries` row for each active device in the same PostgreSQL transaction.

The separate BullMQ worker recovers pending rows into Redis, sends them through Expo, checks provider receipts after 15 minutes, retries temporary failures with backoff, and deactivates tokens reported as `DeviceNotRegistered`. PostgreSQL remains the recoverable source of truth when Redis or the worker is unavailable.
