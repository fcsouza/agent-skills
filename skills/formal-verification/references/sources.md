# Sources

- TLA+ tools releases, stable and pre-release, and the `tla2tools.jar` asset: https://github.com/tlaplus/tlaplus/releases
- Java 11 requirement, running the tools from the jar, `java -jar` as an alias for `tlc2.TLC`: https://github.com/tlaplus/tlaplus/blob/master/README.md
- TLC options (`-config`, `-workers`, `-deadlock`, `-dump`): https://docs.tlapl.us/using:tlc:start
- TLC option parsing at v1.7.4, including the `dot` sub-options `actionlabels`, `colorize`, `snapshot`: https://github.com/tlaplus/tlaplus/blob/v1.7.4/tlatools/org.lamport.tlatools/src/tlc2/TLC.java
- TLC exit statuses at v1.7.4: https://github.com/tlaplus/tlaplus/blob/v1.7.4/tlatools/org.lamport.tlatools/src/tlc2/output/EC.java
- TLC result messages at v1.7.4: https://github.com/tlaplus/tlaplus/blob/v1.7.4/tlatools/org.lamport.tlatools/src/tlc2/output/MP.java
- Config file sections: https://docs.tlapl.us/using:tlc:config_file
- Config format, model values, `CHECK_DEADLOCK FALSE`: https://learntla.com/topics/cli.html
- State graph dumps: https://docs.tlapl.us/using:generating_state_graphs
- fast-check install and first property: https://fast-check.dev/docs/introduction/getting-started/
- fast-check model-based testing (`fc.commands`, `fc.modelRun`, `replayPath`): https://fast-check.dev/docs/advanced/model-based-testing/
- fast-check run parameters (`seed`, `path`, `endOnFailure`, `numRuns`): https://fast-check.dev/docs/api/interfaces/Parameters/
- Mermaid state diagrams and `classDef`: https://mermaid.js.org/syntax/stateDiagram.html
- The talk this skill draws on, "All Code Is Slop (Except Mine)" by Lauren Tan: https://www.youtube.com/watch?v=O_zcc6Xl12g
- Upstream skills this one adapts: https://github.com/cursor/plugins/tree/main/pstack
