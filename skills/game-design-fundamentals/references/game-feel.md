# Game feel checks

Read when a mechanic has real-time control, a simulated space and effects layered on top. Turn-based and click-and-wait mechanics fall outside this. Test each mechanic (one input-to-response loop, such as jump or steer) on its own.

## Numbers to test against

These are the book's figures for continuous control. Treat them as test targets, not laws.

- Frame rate above 10 fps for control; 20 to 30 fps reads as smooth.
- Response to input within about 100 ms. About 50 ms reads as instant. Past 100 ms lag is noticeable. Near 200 ms it feels sluggish.
- Keep response time consistent. Frame drops break continuity even when the mean is fine.
- Do not lock out input for more than about 240 ms in a mechanic the player steers.
- Show some visible, audible or tactile result right away for every input, even if the full effect comes later.
- Measure lag instead of guessing: film screen and controller at 60 fps and count frames from input to first feedback.

## Tuning

- Describe each input mapping in one line: linear or rotational, which dimensions, absolute or relative to avatar or camera, position, rate or magnitude, direct or through a simulation.
- Setting position each frame gives stiff, constant-speed motion. Adding acceleration to a stored velocity, with drag on release, gives arcs and a loose feel. Choose on purpose.
- Treat a driven value (speed, turn rate) as an envelope over time. A long attack reads as floaty. A very short linear attack reads as twitchy. A long attack is acceptable if a first response appears within about 70 to 100 ms.
- Give near-simultaneous button presses one deterministic rule. A random pick between two actions cannot be learned.
- After tuning acceleration, test diagonal and alternating inputs for speed above the intended cap.
- Tune movement and level spacing together. Rules (hit points, rewards) change perceived solidity: add them after the feel is tuned and re-tune if play changes.
- Test the control with the level removed. If steering is not pleasant alone, fix the motion before relying on level design.
- Judge feel by what the player perceives, not by simulation accuracy.

## Polish

Polish tells the player about weight, speed and material. List each interaction (land, hit) against animation, visual effect, sound, camera and tactile columns, and check the signals agree. Cap polish time per interaction by the property it must sell.
