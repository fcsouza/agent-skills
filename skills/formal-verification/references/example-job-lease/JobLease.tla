---- MODULE JobLease ----
\* One job, several workers. A worker takes a lease, does the work, and
\* commits the result. A lease can expire while its holder is still working.
\* Promise: the job's result is committed at most once.
EXTENDS Naturals, FiniteSets

CONSTANTS
    Workers,   \* the workers that compete for the job
    NoOne,     \* model value: nobody holds the lease
    MaxToken,  \* bound on how many times the lease is handed out
    Fenced     \* TRUE: commit checks the fencing token. FALSE: the broken variant.

VARIABLES
    lease,      \* who the lease table says holds the job
    token,      \* fencing token, raised on every acquire
    held,       \* the token each worker believes it holds, 0 for none
    committed   \* the workers that committed a result

vars == <<lease, token, held, committed>>

Init ==
    /\ lease = NoOne
    /\ token = 0
    /\ held = [w \in Workers |-> 0]
    /\ committed = {}

\* A worker takes the free lease of a job that is not done yet.
Acquire(w) ==
    /\ lease = NoOne
    /\ committed = {}
    /\ token < MaxToken
    /\ token' = token + 1
    /\ lease' = w
    /\ held' = [held EXCEPT ![w] = token + 1]
    /\ UNCHANGED committed

\* The lease times out. Its holder does not notice.
Expire ==
    /\ lease # NoOne
    /\ lease' = NoOne
    /\ UNCHANGED <<token, held, committed>>

\* A worker writes the result. With fencing, the store rejects a stale token.
Commit(w) ==
    /\ held[w] # 0
    /\ (Fenced => held[w] = token)
    /\ committed' = committed \cup {w}
    /\ held' = [held EXCEPT ![w] = 0]
    /\ UNCHANGED <<lease, token>>

Next ==
    \/ (\E w \in Workers : Acquire(w))
    \/ Expire
    \/ (\E w \in Workers : Commit(w))

Spec == Init /\ [][Next]_vars

AtMostOneCommit == Cardinality(committed) <= 1
====
