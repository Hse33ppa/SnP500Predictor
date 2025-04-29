from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date
import pandas as pd

# Import functions from other modules
# Use relative import because data_fetcher is in the same package (backend)
from .data.data_fetcher import fetch_sp500_data, fetch_cpi_data, fetch_ohlc_data
from .calculator import calculate_nominal_return, calculate_real_return

app = FastAPI(title="S&P 500 Predictor API")

# --- CORS Middleware --- 
# Allow requests from the frontend development server
origins = [
    "http://localhost:3000",  # React default port
    # Add other origins if needed (e.g., your deployed frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# --- Data Caching (Simple In-Memory) ---
# In a production app, use a more robust cache (e.g., Redis) or fetch on demand
SP500_DATA_CACHE = None
CPI_DATA_CACHE = None

def load_data_caches():
    global SP500_DATA_CACHE, CPI_DATA_CACHE
    print("Loading S&P 500 and CPI data into cache...")
    SP500_DATA_CACHE = fetch_sp500_data()
    CPI_DATA_CACHE = fetch_cpi_data()
    if SP500_DATA_CACHE.empty or CPI_DATA_CACHE.empty:
        print("Warning: Failed to load one or both data caches on startup.")
    else:
        print("Data caches loaded successfully.")

@app.on_event("startup")
async def startup_event():
    load_data_caches() # Load data when the app starts

# --- Pydantic Models --- 
class CalculatorInput(BaseModel):
    start_date: date
    end_date: date
    initial_investment: float

class OHLCInput(BaseModel):
    ticker: str = "^GSPC" # Default to S&P 500 index
    start_date: date
    end_date: date

# --- API Endpoints --- 

@app.get("/")
def read_root():
    return {"message": "Welcome to the S&P 500 Predictor API"}

@app.post("/calculator")
def calculate_returns_endpoint(data: CalculatorInput):
    """Calculates nominal and real returns for a given period and investment."""
    if SP500_DATA_CACHE is None or CPI_DATA_CACHE is None or SP500_DATA_CACHE.empty or CPI_DATA_CACHE.empty:
        raise HTTPException(status_code=503, detail="Historical data is not available or failed to load. Please try again later.")

    if data.start_date >= data.end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date.")

    # Convert dates to strings for calculator functions if needed (adjust based on function signature)
    start_date_str = data.start_date.strftime('%Y-%m-%d')
    end_date_str = data.end_date.strftime('%Y-%m-%d')

    # Perform calculations
    nominal_result = calculate_nominal_return(
        start_date=start_date_str, 
        end_date=end_date_str, 
        initial_investment=data.initial_investment, 
        sp500_data=SP500_DATA_CACHE
    )

    if "error" in nominal_result:
        raise HTTPException(status_code=400, detail=f"Nominal calculation error: {nominal_result['error']}")

    final_result = calculate_real_return(
        nominal_result=nominal_result,
        start_date=start_date_str,
        end_date=end_date_str,
        cpi_data=CPI_DATA_CACHE
    )

    if "error" in final_result:
         raise HTTPException(status_code=400, detail=f"Real calculation error: {final_result['error']}")

    return final_result

@app.post("/ohlc")
def get_ohlc_data_endpoint(data: OHLCInput):
    """Fetches OHLC data for a given ticker and date range."""
    if data.start_date >= data.end_date:
        raise HTTPException(status_code=400, detail="Start date must be before end date.")

    start_date_str = data.start_date.strftime('%Y-%m-%d')
    end_date_str = data.end_date.strftime('%Y-%m-%d')

    ohlc_df = fetch_ohlc_data(ticker=data.ticker, start_date=start_date_str, end_date=end_date_str)

    if ohlc_df.empty:
        raise HTTPException(status_code=404, detail=f"No OHLC data found for {data.ticker} in the specified date range.")

    # Convert DataFrame to list of dictionaries suitable for JSON response
    # Reset index to make 'Date' a column, then convert to dict
    ohlc_data = ohlc_df.reset_index().to_dict(orient='records')
    # Convert Timestamp objects to strings
    for record in ohlc_data:
        record['Date'] = record['Date'].strftime('%Y-%m-%d')

    return {"ticker": data.ticker, "data": ohlc_data}

# Placeholder for prediction endpoint
@app.get("/predict")
def get_predictions():
    # Prediction logic will go here
    # Needs ML model integration
    return {"message": "Prediction endpoint placeholder - ML model not yet integrated"}