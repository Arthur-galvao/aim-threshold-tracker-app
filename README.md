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
- **Raw Accel Integration:** Automatic detection of the Raw Accel driver folder and transparent application of sensitivity multipliers to the configuration file.
- **Operational Modes:** Configurable ranges by absolute physical sensitivity (cm/360) or relative multiplier, with anti-repetition protection.
- **Sweet Spot Detection:** Range binning with empirical Bayesian shrinkage to prevent premature conclusions on small sample sizes, computing motor consistency and reporting statistical confidence levels (High, Medium, Low, or Preliminary Sample).
- **Interactive Visualizations:** Scatter plot correlating physical sensitivity with performance scores, fitted with a least-squares quadratic trend curve.

## Contributing

To run the project locally or submit improvements, check [CONTRIBUTING.md](./CONTRIBUTING.md) (também disponível em [Português](./CONTRIBUTING.pt-BR.md)).

## License

Distributed under the MIT License. See [LICENSE](./LICENSE) for details.
