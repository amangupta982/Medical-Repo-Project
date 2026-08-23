"""
Unit tests for data/raw/download_datasets.py outputs and schema correctness.
"""
import os
import json
import pandas as pd
import pytest

RAW_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw"))


def test_health_centres_district_csv_schema_and_contents():
    filepath = os.path.join(RAW_DIR, "india_health_centres_district.csv")
    assert os.path.exists(filepath), f"File missing: {filepath}"
    df = pd.read_csv(filepath)
    expected_cols = ["district", "phcs", "chcs", "sub_centres", "population_2011"]
    for col in expected_cols:
        assert col in df.columns, f"Missing column {col} in {filepath}"
    assert len(df) == 10, f"Expected 10 districts, got {len(df)}"
    assert df["phcs"].min() > 0
    assert df["population_2011"].min() > 100000
    assert df[expected_cols].isna().sum().sum() == 0


def test_epiclim_surveillance_csv_schema_and_contents():
    filepath = os.path.join(RAW_DIR, "epiclim_disease_surveillance.csv")
    assert os.path.exists(filepath), f"File missing: {filepath}"
    df = pd.read_csv(filepath)
    required_cols = ["mapped_district", "Disease", "Cases"]
    for col in required_cols:
        assert col in df.columns, f"Missing column {col} in {filepath}"
    assert len(df) > 0, "Expected non-empty surveillance records"
    assert df["mapped_district"].notna().all()


def test_idsp_seasonal_reference_json_structure():
    filepath = os.path.join(RAW_DIR, "idsp_seasonal_reference.json")
    assert os.path.exists(filepath), f"File missing: {filepath}"
    with open(filepath) as f:
        data = json.load(f)

    assert "malaria_dengue_seasonality" in data
    assert "gi_outbreak_seasonality" in data
    assert "bed_occupancy_dynamics" in data
    assert "supply_chain_parameters" in data

    md = data["malaria_dengue_seasonality"]
    assert 1 <= md["peak_doy"] <= 365
    assert 10 <= md["sigma_days"] <= 90
    assert md["amplitude"] >= 1.0
    assert len(md["monthly_relative_risk"]) == 12

    sc = data["supply_chain_parameters"]
    assert "standard_phc_lead_time_days" in sc
    assert "remote_phc_lead_time_days" in sc
    assert 0 < sc["standard_supply_failure_rate"] < 1.0


def test_dengue_cases_india_csv_schema_and_contents():
    filepath = os.path.join(RAW_DIR, "dengue_cases_india.csv")
    assert os.path.exists(filepath), f"File missing: {filepath}"
    df = pd.read_csv(filepath)
    required_cols = ["Year", "States/UTs", "Cases", "Deaths"]
    for col in required_cols:
        assert col in df.columns
    assert "Total" in df["States/UTs"].values
    assert "Karnataka" in df["States/UTs"].values
    assert df["Cases"].min() > 0
