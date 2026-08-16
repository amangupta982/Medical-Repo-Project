# Data Sources

This platform is honest about what is real data versus what is simulated. No
public dataset exists at daily PHC-level granularity (medicine stock, patient
footfall, staff attendance per facility per day) — that gap is exactly what
the problem statement describes. Where a real dataset exists, we use it to
**calibrate** the synthetic operational layer rather than inventing numbers.

## Real datasets used for calibration

| Purpose | Dataset | Source | License | How it's used |
|---|---|---|---|---|
| PHC/CHC network scale | District-Wise Availability of Health Centres in India | data.gov.in — Rural Health Statistics | Government Open Data License – India | Grounds the number of PHCs per district and catchment population ranges |
| Disease seasonality | IDSP weekly vector-borne disease surveillance analysis (2020–2023) | Published secondary analysis, Indian Journal of Community Medicine | Academic / public | Calibrates the malaria/dengue seasonal curve — real analysis shows 63–80% of malaria outbreaks occur in H2 of the year (post-monsoon), which the synthetic seasonality curve mirrors |
| Dengue case trends | "Dengue Cases in India" | Kaggle (jadhavpranav/dengue-cases-in-india) | Kaggle dataset terms | Calibrates outbreak magnitude/frequency assumptions |
| Bed occupancy dynamics | Hospital bed occupancy forecasting studies (incl. an Indian mental-health-hospital case study using Prophet/XGBoost) | BMC Medical Informatics and Decision Making; Scientific Reports | Open access | Validates realistic bed-occupancy volatility ranges used in the simulator |

### Actual data files

The real calibration datasets are committed in `data/raw/`:

| File | Contents | See |
|---|---|---|
| `data/raw/india_health_centres_district.csv` | All 30 Karnataka districts — PHC/CHC/SC counts, population, area | `data/raw/README.md` |
| `data/raw/dengue_cases_india.csv` | State-wise dengue cases & deaths, 2017–2023 (NCVBDC) | `data/raw/README.md` |
| `data/raw/idsp_seasonal_reference.json` | Exact seasonal curves, bed-occupancy bounds, supply-chain params with citations | `data/raw/README.md` |

Run `python data/raw/download_datasets.py` to verify all files are present.

## Synthetic layer (clearly labeled, not claimed as real)

Daily PHC-level records — medicine consumption, patient footfall, staff
attendance, bed occupancy, inventory levels, resupply events — are
**generated**, not sourced. Generation uses:

- Reorder-point / lead-time inventory mechanics (not arbitrary random walks):
  stock depletes with real daily consumption, resupply is triggered at a
  reorder threshold and arrives after a lead time, with a probabilistic
  supply-chain failure rate (higher for remote PHCs) — this is what makes
  genuine stock-outs emerge from the mechanics rather than being hand-set.
- Seasonal multipliers calibrated to the IDSP-derived curve above.
- District-level outbreak shock events (random onset, duration, intensity).
- Realistic missingness (~2% of footfall readings) to simulate device/reporting gaps.

**Anyone reviewing this project should treat every daily PHC-level number as
simulated.** Only the network topology (district/PHC counts) and the
seasonality/volatility *shape* are grounded in cited real-world sources.

## Federated learning clients

The 5 "BRICS" federated clients (India, Brazil, Russia, China, South Africa)
are **simulated partitions** of the same underlying synthetic dataset, each
re-weighted with a different demand/lead-time/outbreak profile to create
genuine non-IID heterogeneity across clients (see
`backend/app/ml/federated/federated_train.py` for the exact profile values).
This is a real, working Flower federated-learning harness — but the country
labels are illustrative simulated clients, not real national health records.
This is stated explicitly in the Federated Learning page of the dashboard.
