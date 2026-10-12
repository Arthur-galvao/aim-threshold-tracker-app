# Aim Threshold Tracker

[English](README.md) | [Português (Brasil)](README.pt-BR.md)

[![Download](https://img.shields.io/github/v/release/Arthur-galvao/aim-threshold-tracker-app?label=download&style=for-the-badge)](https://github.com/Arthur-galvao/aim-threshold-tracker-app/releases/latest)

Desktop application for tracking aim thresholds in KovaaK's, following the Viscose benchmark methodology and Escalate standard, featuring controlled sensitivity randomization and empirical Bayesian Sweet Spot statistical analysis.

## Download

**[Download Windows Installer (.exe)](https://github.com/Arthur-galvao/aim-threshold-tracker-app/releases/latest)**

Available for Windows. Does not require administrator privileges to install.

## Key Features

### Threshold & Metric Tracking
- **Real-Time Watcher:** Automatically detects the KovaaK's stats directory (via Steam) and processes new matches in real time directly from CSV files.
- **Dynamic Threshold Calculation:** Systematic progression of scoring targets based on individual historical performance.
- **Score Normalization:** Fair comparison across scenarios with different score scales using percentage of Personal Best (% of PB).
- **Escalate Formatting:** One-click clipboard export formatted for immediate community sharing.
- **Local Privacy:** All data is stored locally on your machine via SQLite/JSON; no data is sent to external servers.

### Sensitivity Randomizer & Sweet Spot Analysis
- **Raw Accel Safe Driver Management:** Automatic detection of Raw Accel directory, preserving original Output DPI and modifying only the scale parameter. Includes automatic JSON backup on startup and reliable restoration on application exit or shutdown.
- **Logarithmic Exponential Lattice:** Discrete sensitivity sampling anchored at 50 cm with a 1.05 step ratio (`50 * 1.05^k`), drawn via a shuffled bag without replacement with a minimum gap constraint.
- **Predictive Sweet Spot Modeling:** Combined parametric quadratic regression in log-space and kernel smoothing with bootstrap confidence intervals (90% CI) and hierarchical Bayesian category blending.
- **Predictor Profiles & Recentering:** 4 statistical tuning profiles (Balanced, Neutral, Theoretical, Consistency) stored in settings, with automatic drift detection and manual recenter suggestions.
- **Interactive Visualizations:** Log-scale scatter plot, quadratic trend and kernel curves, active range boundary markers, apex confidence interval indicator, and real-time lattice coverage bar.

## Contributing

To run the project locally or submit improvements, check [CONTRIBUTING.md](./CONTRIBUTING.md) (também disponível em [Português](./CONTRIBUTING.pt-BR.md)).

## License

Distributed under the MIT License. See [LICENSE](./LICENSE) for details.
