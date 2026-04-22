# NexaClinic Security Specification

## 1. Data Invariants
- A doctor must be authorized (exist in `/doctors`) to perform any action.
- A patient record must be created by a doctor and can only be accessed by the creator or an admin.
- A visit must belong to a valid patient.
- Timestamps must be numbers (though production rules prefer `request.time`, the app uses `Date.now()`).
- Document IDs must follow strict character limits and characters.

## 2. The "Dirty Dozen" Payloads (All must be PERMISSION_DENIED)

1. **Identity Spoofing**: Create a patient with `created_by` set to another doctor's email.
2. **Privilege Escalation**: A non-admin trying to update their own role in `doctors/{email}` to `admin`.
3. **Ghost Field Injection**: Adding a `is_verified_by_admin: true` field to a `Patient` document.
4. **Resource Poisoning**: Document ID with 2KB string for a visit.
5. **Orphaned Visit**: Creating a visit for a non-existent `patientId`.
6. **Self-Deletion Protection**: An admin trying to delete their own record in `doctors`.
7. **PII Leak**: A doctor trying to `list` patients created by another doctor (if they are not an admin).
8. **Immutable Field Tampering**: Updating `created_at` on a patient document.
9. **Role Bypass**: An unauthorized email (not in `doctors`) trying to create a patient.
10. **Array Explosion**: Trying to add 1 million URLs to `history_images`.
11. **State Shortcut**: Updating `is_favorite` without being the creator/admin.
12. **Cross-Tenant Access**: Reading visits of a patient that was NOT created by the doctor.

## 3. Test Runner Plan
I'll implement `firestore.rules.test.ts` to verify these.
