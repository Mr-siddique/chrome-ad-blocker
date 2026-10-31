# Agentic Development Loop Guide

## What is Spec-Driven Agentic Development?

Instead of you writing all the code, **agents** execute the loop:
- **SPECIFY** → Human writes spec, Spec Agent clarifies it
- **PLAN** → Plan Agent breaks spec into tasks
- **BUILD** → Build Agent implements tasks
- **TEST** → Test Agent validates code
- **REVIEW** → Review Agent checks spec compliance
- **ITERATE** → If failures, loop back to BUILD

The loop runs **automatically** until convergence (code meets all spec requirements).

## The Loop at a Glance

```
┌─────────────────────────────────────────────────────┐
│ START: Write/Update SPEC.md                         │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ SPECIFY PHASE                                       │
│ ├─ Spec Agent refines SPEC.md                      │
│ │  ├─ Makes criteria testable                      │
│ │  ├─ Quantifies targets                           │
│ │  └─ Documents edge cases                         │
│ └─ HUMAN REVIEWS: "Approve this spec?" (yes/no)   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ PLAN PHASE                                          │
│ ├─ Plan Agent creates progress/PLAN.md            │
│ │  ├─ Task breakdown                              │
│ │  ├─ File changes                                │
│ │  └─ Dependencies                                │
│ └─ HUMAN REVIEWS: "Approve this plan?" (yes/no)   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ BUILD PHASE                                         │
│ ├─ Build Agent implements task by task             │
│ │  ├─ Writes code in src/                         │
│ │  ├─ Writes tests                                │
│ │  └─ Commits after each task                     │
│ └─ (Auto, no human gate)                           │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ TEST PHASE                                          │
│ ├─ Test Agent runs all tests                       │
│ │  ├─ Unit tests                                  │
│ │  ├─ Integration tests                           │
│ │  ├─ Performance benchmarks                      │
│ │  └─ Coverage report                             │
│ ├─ Creates progress/test-results.json            │
│ └─ BLOCKS if coverage <80% or benchmarks fail     │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ REVIEW PHASE                                        │
│ ├─ Review Agent checks spec compliance             │
│ │  ├─ All acceptance criteria tested?              │
│ │  ├─ Coverage adequate?                          │
│ │  ├─ Performance targets met?                    │
│ │  └─ Code quality acceptable?                    │
│ ├─ Creates progress/review-report.md             │
│ └─ APPROVED → Merge to main                        │
│    REJECTED → Go to ITERATE                        │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
    APPROVED          REJECTED
        │                 │
        ▼                 │
      DONE            ITERATE PHASE
                          │
                          ▼
                    Build Agent fixes
                    Run TEST + REVIEW
                    again (max 3x)
                          │
                          └──→ Back to TEST
```

## Commands to Use

### Start the Loop
```bash
orchestrator start-loop
```

This:
1. Reads SPEC.md
2. Triggers Spec Agent (if needed)
3. Asks you to approve spec
4. Triggers Plan Agent
5. Asks you to approve plan
6. Triggers Build Agent
7. Waits for completion

### Check Status
```bash
orchestrator status
```

Shows:
- Current phase
- Last agent that ran
- Progress %
- Latest commits

### Resume After Interruption
```bash
orchestrator resume-loop
```

Resumes from where loop paused (at human gate or agent error).

### Force Next Phase (Override)
```bash
orchestrator trigger-phase PLAN
```

Skip to a specific phase (use carefully, may cause errors).

### Debug Current State
```bash
orchestrator debug-state
```

Shows:
- Git status
- Current SPEC.md
- Current PLAN.md
- Latest test results

## Human Decision Points (Gates)

You MUST approve at these points:

### Gate 1: After SPECIFY
```
📋 Spec Agent completed. Please review SPEC.md:
   - Are acceptance criteria clear?
   - Are performance targets quantified?
   
   Approve? (yes/no)
   → If yes, proceed to PLAN
   → If no, edit SPEC.md and try again
```

### Gate 2: After PLAN
```
📐 Plan Agent created progress/PLAN.md with tasks:
   - Task 1: Core filter detection (Medium scope)
   - Task 2: Popup UI (Medium scope)
   - Task 3: Storage & whitelist (Small scope)
   
   Approve? (yes/no)
   → If yes, proceed to BUILD
   → If no, edit PLAN.md and try again
```

### Gate 3: After REVIEW (if rejected)
```
🔍 Review Agent found blockers:
   - Missing test for whitelist feature
   - Coverage below 80% for popup.js
   
   Fix? (yes/no)
   → If yes, Build Agent will re-run and fix
   → If no, loop pauses (human debug needed)
```

## Monitoring the Loop

### Progress File (`progress/status.md`)
Updated by Orchestrator after each phase:
```markdown
# Status: 2024-01-15

Current Phase: BUILD
Last Agent: build-agent
Progress: 75% (Tasks 1-3 complete, Task 4 in progress)

Latest commits:
- Task 1: Core filter with domain detection
- Task 2: Popup UI with whitelist button
- Task 3: Storage wrapper (in progress)
```

### Test Results (`progress/test-results.json`)
Created by Test Agent:
```json
{
  "status": "PASS",
  "tests": { "total": 32, "passed": 32 },
  "coverage": { "statements": 87 },
  "performance": { "filter-matching": { "pass": true } }
}
```

### Review Report (`progress/review-report.md`)
Created by Review Agent:
```markdown
# Code Review Report

Status: APPROVED
- All 7 acceptance criteria met ✅
- Coverage 87% (target 80%) ✅
- Performance targets met ✅
```

## Loop Lifecycle

### Happy Path (No Issues)
```
START
  ↓
SPECIFY (5 min) → You approve
  ↓
PLAN (5 min) → You approve
  ↓
BUILD (30 min, auto)
  ↓
TEST (5 min, auto)
  ↓
REVIEW (5 min, auto)
  ↓
✅ DONE (merged to main)

Total: ~1 hour
```

### With Issues (Failed Tests)
```
START
  ↓
SPECIFY → PLAN → BUILD
  ↓
TEST (fails, coverage <80%)
  ↓
ITERATE (loop back to BUILD)
  ↓
BUILD Agent fixes
  ↓
TEST (passes)
  ↓
REVIEW (approves)
  ↓
✅ DONE

Total: ~1.5-2 hours
```

### Escalation (Can't Auto-Fix)
```
START → SPECIFY → PLAN → BUILD → TEST
  ↓
REVIEW (rejects, spec not met)
  ↓
ITERATE → BUILD (same issue)
  ↓
ITERATE → BUILD (same issue again)
  ↓
ESCALATE TO HUMAN (3 failed attempts)
  ↓
You fix manually or re-write spec
```

## Convergence Rules

The loop **exits successfully** when:
```
✅ All acceptance tests pass
✅ Coverage >80%
✅ Performance targets met
✅ Review Agent approves
```

The loop **escalates to human** when:
```
❌ BUILD fails 3x on same bug
❌ TEST can't reach target coverage
❌ Performance can't be optimized further
❌ Spec conflicts with implementation
```

## Common Workflows

### Changing Requirements Mid-Loop
```
1. You update SPEC.md
2. orchestrator start-loop
3. Spec Agent re-refines spec
4. Orchestrator re-plans from scratch
5. Loop continues from PLAN phase
```

### Fixing a Single Bug
```
1. orchestrator debug-state (see what failed)
2. Edit PLAN.md to identify failing task
3. orchestrator trigger-phase BUILD
4. Build Agent re-runs just that task
5. orchestrator resume-loop (continues from TEST)
```

### Pausing and Resuming
```
# Work got interrupted
1. orchestrator status (see where we are)
2. ... come back later ...
3. orchestrator resume-loop (picks up where left off)
```

### Manual Debugging
```
# Loop stuck, need to debug manually
1. orchestrator debug-state
2. npm test (run tests locally)
3. git log (see what was committed)
4. Edit failing code manually
5. git add && git commit
6. orchestrator resume-loop (loop resumes from TEST)
```

## What Each Agent Does

| Agent | Input | Output | Time |
|-------|-------|--------|------|
| Spec | SPEC.md (draft) | SPEC.md (refined) | 5 min |
| Plan | SPEC.md | progress/PLAN.md | 5 min |
| Build | progress/PLAN.md | Code + commits | 30 min |
| Test | Code | progress/test-results.json | 5 min |
| Review | Code + spec | progress/review-report.md | 5 min |

## Troubleshooting

**Loop seems stuck?**
→ Run `orchestrator status` to see what phase it's in

**Tests failing repeatedly?**
→ Run `npm test` locally to debug, then `orchestrator resume-loop`

**Review Agent rejected, but why?**
→ Read `progress/review-report.md` for blockers

**Need to change the spec?**
→ Edit `SPEC.md` and run `orchestrator start-loop` again

**Want to add a file agent didn't create?**
→ Create it, commit it, update `progress/PLAN.md`, resume loop

## Remember

- **You control the gates** - Nothing moves forward without your approval
- **SPEC is law** - Agents can't add features outside the spec
- **Tests catch bugs** - Test Agent blocks unsafe code
- **Review enforces spec** - Review Agent blocks unmet requirements
- **Humans override** - You can always take over and fix things manually
