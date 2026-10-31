# Quick Start Guide - Agentic Development Loop

**Project:** Chrome Ad Blocker Extension  
**Method:** Spec-driven agentic development  
**Status:** ✅ Framework initialized, ready to start  

## What's Been Set Up

Your project is now configured for **automated agent-driven development** with human review gates.

```
✅ Repository initialized (git)
✅ Agent instructions created (agents/*.md)
✅ Test framework configured (jest)
✅ Documentation written (docs/)
✅ Initial spec created (SPEC.md)
✅ Project structure organized
```

## The Agentic Loop (30 seconds)

```
You write spec → Spec Agent refines it → You approve ✓
      ↓
You review plan → Plan Agent breaks into tasks → You approve ✓
      ↓
Build Agent writes code + tests (auto)
      ↓
Test Agent runs tests + benchmarks (auto, blocks if fails)
      ↓
Review Agent checks spec compliance (auto, blocks if unmet)
      ↓
✅ Code merged to main
```

## Get Started in 3 Steps

### Step 1: Review the Specification
```bash
cd /Users/aamir/Desktop/personal/chrome-ad-blocker
cat SPEC.md
```

This is the **source of truth**. All code must implement something in this spec.

**What to check:**
- Are acceptance criteria clear? (should be testable)
- Are performance targets quantified? (should have numbers)
- Do you agree with the scope?

**If you want to change the spec:**
- Edit SPEC.md directly
- Run the loop (agents will refine your changes)

### Step 2: Start the Agentic Loop
```bash
npm install              # Install dependencies first
orchestrator start-loop  # Begin automated development
```

The orchestrator will:
1. ✅ Run Spec Agent (refine your spec)
2. 🎯 Ask you to approve spec
3. ✅ Run Plan Agent (create task breakdown)
4. 🎯 Ask you to approve plan
5. ✅ Run Build Agent (implement tasks)
6. ✅ Run Test Agent (validate code)
7. ✅ Run Review Agent (check spec compliance)
8. 🎯 Ask you to approve final code
9. ✅ Merge to main

**You only need to approve at gates (2-3 quick decisions).**

### Step 3: Monitor Progress
```bash
# Check current status
orchestrator status

# View detailed progress
cat progress/status.md

# After testing
cat progress/test-results.json

# After review
cat progress/review-report.md
```

## Key Files You'll Use

| File | Purpose |
|------|---------|
| **SPEC.md** | Feature specification (edit this, agents follow it) |
| **progress/status.md** | Loop status and progress |
| **progress/PLAN.md** | Task breakdown (created by Plan Agent) |
| **progress/test-results.json** | Test coverage and performance (created by Test Agent) |
| **progress/review-report.md** | Spec compliance check (created by Review Agent) |
| **README.md** | Project overview |
| **docs/ARCHITECTURE.md** | System design |
| **docs/AGENT_LOOP.md** | How the loop works |

## Commands

```bash
# Start agentic development
orchestrator start-loop

# Check what phase we're in
orchestrator status

# Resume after interruption
orchestrator resume-loop

# Force to specific phase (override)
orchestrator trigger-phase PLAN

# Debug current state
orchestrator debug-state

# Run tests manually
npm test

# Run performance benchmarks
npm run benchmark

# Check code coverage
npm test -- --coverage
```

## What Happens at Each Gate

### Gate 1: Approve Spec
```
Spec Agent outputs refined SPEC.md:
  ✓ Makes criteria testable
  ✓ Quantifies targets
  ✓ Documents edge cases

You: "Is this spec clear?" 
  → yes  → Proceed to PLAN
  → no   → Edit SPEC.md, retry
```

### Gate 2: Approve Plan
```
Plan Agent outputs progress/PLAN.md:
  ✓ Task list with dependencies
  ✓ Files to create/modify
  ✓ Scope per task

You: "Is this plan reasonable?"
  → yes  → Proceed to BUILD
  → no   → Edit PLAN.md, retry
```

### Gate 3: Approve Final Code
```
Review Agent outputs progress/review-report.md:
  ✓ All spec criteria met
  ✓ Coverage >80%
  ✓ Performance targets met
  ✓ Code quality acceptable

You: "Ready to merge?"
  → yes  → Merge to main ✅
  → no   → Build Agent fixes, retries
```

## File Structure After Setup

```
chrome-ad-blocker/
├── SPEC.md                     ← Your spec (edit this)
├── QUICKSTART.md              ← This file
├── README.md                  ← Project overview
├── package.json               ← Dependencies
├── jest.config.js             ← Test config
├── .gitignore
│
├── agents/                    ← Agent instructions
│   ├── orchestrator.md        ← Loop coordinator
│   ├── spec.md               ← Spec refiner
│   ├── planner.md            ← Task planner
│   ├── builder.md            ← Code writer
│   ├── tester.md             ← Test runner
│   └── reviewer.md           ← Spec checker
│
├── .claude/
│   └── settings.json         ← Claude Code config
│
├── src/                       ← Extension code (created by Build Agent)
│   ├── manifest.json
│   ├── background.js
│   ├── content-script.js
│   ├── popup.html/js/css
│   ├── options.html/js
│   └── utils/
│
├── tests/                     ← Tests (created by Build Agent)
│   ├── unit/
│   ├── integration/
│   ├── performance/
│   └── setup.js
│
├── docs/                      ← Documentation
│   ├── ARCHITECTURE.md        ← System design
│   ├── AGENT_LOOP.md         ← Loop explanation
│   └── CONTRIBUTING.md        ← Contributing guide
│
└── progress/                  ← Agent-generated progress
    ├── status.md             ← Current phase + progress
    ├── PLAN.md              ← Task breakdown
    ├── test-results.json    ← Test results
    └── review-report.md     ← Code review
```

## Performance Targets (From Spec)

The Review Agent will enforce these:

| Metric | Target | Test Location |
|--------|--------|---------------|
| Block accuracy | ≥95% | tests/unit/filters.test.js |
| False positives | <2% | tests/unit/filters.test.js |
| Content script overhead | <50ms | tests/performance/benchmarks.js |
| Filter load time | <200ms | tests/performance/benchmarks.js |
| Test coverage | >80% | jest coverage report |

## Typical Timeline

✅ **Happy path** (no issues): ~1 hour
- Spec Agent: 5 min
- You approve: 1 min
- Plan Agent: 5 min
- You approve: 1 min
- Build Agent: 30 min (auto)
- Test Agent: 5 min (auto)
- Review Agent: 5 min (auto, approves)
- You approve: 1 min
- **Done!**

⚠️ **With fixes** (test failures): ~1.5-2 hours
- Same as above, plus
- Test fails → Build Agent fixes → Re-test
- Review requests changes → Build Agent fixes → Re-review

🚨 **Escalation** (can't auto-fix): ~2-3 hours
- Loop tries 3× to fix same issue
- You debug manually
- Resume loop

## Tips

1. **Read SPEC.md first** - Understand what you're building
2. **Trust the agents** - They follow strict rules
3. **Approve early** - Gates are quick decisions
4. **Monitor progress** - Check `progress/status.md` occasionally
5. **Debug locally if stuck** - `npm test` helps
6. **Agents are deterministic** - Same input → same output

## If Something Goes Wrong

```bash
# Check what's happening
orchestrator status

# See detailed state
orchestrator debug-state

# Run tests locally to debug
npm test

# Manually fix, then resume
orchestrator resume-loop

# If totally stuck
git log                    # See commits
git status                 # See changes
# Fix manually, commit
git add . && git commit -m "Manual fix: ..."
orchestrator resume-loop   # Resume from that point
```

## Next Steps

1. **Read SPEC.md** to understand requirements
2. **Run:** `cd /Users/aamir/Desktop/personal/chrome-ad-blocker && npm install`
3. **Start loop:** `orchestrator start-loop`
4. **Approve specs** as agents run
5. **Monitor progress** with `orchestrator status`
6. **Celebrate** when Review Agent approves! 🎉

## Help & Documentation

- **"How does the loop work?"** → Read `docs/AGENT_LOOP.md`
- **"What's the system design?"** → Read `docs/ARCHITECTURE.md`
- **"How do I contribute?"** → Read `docs/CONTRIBUTING.md`
- **"What does [agent] do?"** → Read `agents/[agent].md`
- **"How do I use [command]?"** → Run `orchestrator help` or check `README.md`

---

**Ready to build?** 

```bash
cd /Users/aamir/Desktop/personal/chrome-ad-blocker
npm install
orchestrator start-loop
```

The agents are waiting! 🤖
