-- Add a dedicated store-scoped role for approval submission and participant-only communication.
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'STORE_REQUESTER';
