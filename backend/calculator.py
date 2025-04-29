# backend/calculator.py
import pandas as pd
from datetime import datetime

def calculate_nominal_return(start_date: str, end_date: str, initial_investment: float, sp500_data: pd.DataFrame):
    """Calculates nominal total return including dividends (placeholder)."""
    # This is a simplified placeholder. Actual implementation needs:
    # 1. Accurate S&P 500 price data for the period.
    # 2. Accurate S&P 500 dividend data for the period.
    # 3. Logic to reinvest dividends monthly/quarterly.
    
    try:
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)

        # Filter data (ensure data covers the range)
        relevant_data = sp500_data[(sp500_data.index >= start_dt) & (sp500_data.index <= end_dt)]
        
        if relevant_data.empty or relevant_data.index[0] > start_dt or relevant_data.index[-1] < end_dt:
             print(f"Warning: Data missing for range {start_date} to {end_date}")
             # Handle missing data appropriately - here we just use available start/end
             if relevant_data.empty:
                 return {"error": "Insufficient S&P 500 data for the selected period."}

        start_price = relevant_data['value'].iloc[0]
        end_price = relevant_data['value'].iloc[-1]

        # --- Placeholder for Dividend Reinvestment --- 
        # This is highly simplified. Real calculation is complex.
        # Assume a simple price appreciation for now.
        # A proper implementation would fetch dividend data and simulate reinvestment.
        price_return = (end_price / start_price) - 1
        # Add a placeholder dividend yield estimate (e.g., 1.5% annualized average)
        years = (end_dt - start_dt).days / 365.25
        # Simplified total return estimate
        # WARNING: This is NOT accurate dividend reinvestment
        estimated_total_return_factor = (1 + price_return) # * (1 + 0.015 * years) # Very rough dividend estimate
        
        final_value = initial_investment * estimated_total_return_factor
        total_return_pct = estimated_total_return_factor - 1
        
        return {
            "start_date": start_date,
            "end_date": end_date,
            "initial_investment": initial_investment,
            "final_nominal_value": round(final_value, 2),
            "nominal_total_return_pct": round(total_return_pct * 100, 2), # Percentage
            "calculation_notes": "Simplified calculation without actual dividend reinvestment."
        }

    except Exception as e:
        print(f"Error in nominal calculation: {e}")
        return {"error": f"Calculation error: {e}"}

def calculate_real_return(nominal_result: dict, start_date: str, end_date: str, cpi_data: pd.DataFrame):
    """Calculates inflation-adjusted (real) return."""
    if "error" in nominal_result:
        return nominal_result # Pass through errors
        
    try:
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)

        # Find CPI values closest to start and end dates
        cpi_start_val = cpi_data['value'].asof(start_dt)
        cpi_end_val = cpi_data['value'].asof(end_dt)

        if pd.isna(cpi_start_val) or pd.isna(cpi_end_val) or cpi_start_val == 0:
            return {"error": "Insufficient CPI data for the selected period."}

        inflation_rate = (cpi_end_val / cpi_start_val) - 1
        
        nominal_total_return_factor = 1 + (nominal_result["nominal_total_return_pct"] / 100.0)
        
        real_return_factor = nominal_total_return_factor / (1 + inflation_rate)
        real_total_return_pct = (real_return_factor - 1) * 100
        final_real_value = nominal_result["initial_investment"] * real_return_factor

        nominal_result["final_real_value"] = round(final_real_value, 2)
        nominal_result["real_total_return_pct"] = round(real_total_return_pct, 2)
        nominal_result["total_inflation_pct"] = round(inflation_rate * 100, 2)
        
        # Add CAGR calculation
        years = (end_dt - start_dt).days / 365.25
        if years > 0:
             nominal_cagr = ((nominal_total_return_factor)**(1/years) - 1) * 100
             real_cagr = ((real_return_factor)**(1/years) - 1) * 100
             nominal_result["nominal_cagr_pct"] = round(nominal_cagr, 2)
             nominal_result["real_cagr_pct"] = round(real_cagr, 2)
        else:
             nominal_result["nominal_cagr_pct"] = 0
             nominal_result["real_cagr_pct"] = 0
             
        nominal_result.pop("calculation_notes", None) # Remove intermediate note
        nominal_result["calculation_notes"] = "Simplified nominal return (no dividend reinvestment). Real return adjusted using CPI."

        return nominal_result

    except Exception as e:
        print(f"Error in real calculation: {e}")
        return {"error": f"Real return calculation error: {e}"}