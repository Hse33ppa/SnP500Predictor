import React, { useState } from 'react';
import './App.css';
import {
  ChartCanvas,
  Chart,
  CandlestickSeries,
  XAxis,
  YAxis,
  CrossHairCursor,
  MouseCoordinateX,
  MouseCoordinateY,
  discontinuousTimeScaleProvider,
  // ohlc, // Removed
  // fitWidth, // Removed
} from 'react-financial-charts';
import { timeFormat } from 'd3-time-format';
import { format as d3Format } from 'd3-format';

interface OHLCData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CalculationResult {
  maxDrawdown: number;
  maxDrawdownPeriod: string;
  totalReturn: number;
  cagr: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  volatility: number;
  bestMonthReturn: number;
  worstMonthReturn: number;
  avgMonthlyReturn: number;
  positiveMonths: number;
  negativeMonths: number;
}

function App() {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [initialInvestment, setInitialInvestment] = useState<number>(10000);
  const [ohlcData, setOhlcData] = useState<OHLCData[]>([]); // Renamed data to ohlcData
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  // Removed unused refs and useEffect

  const fetchData = async () => {
    setError(null); // Clear previous errors
    setCalculationResult(null); // Use correct setter
    setOhlcData([]); // Use correct setter and initialize as empty array
    setLoading(true);

    // Basic validation
    if (!startDate || !endDate || initialInvestment <= 0) { // Added check for positive investment
      setError('Please fill in all fields and provide a valid initial investment.');
      setLoading(false); // Stop loading on validation error
      return;
    }

    try {
      // Fetch calculation results
      const calcResponse = await fetch('http://localhost:8000/calculator', { // Assuming backend runs on port 8000
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          initial_investment: initialInvestment, // Pass number directly
        }),
      });

      if (!calcResponse.ok) {
        // Handle HTTP errors
        const errorData = await calcResponse.json().catch(() => ({ detail: 'An unknown error occurred fetching calculation results.' })); // Try to parse error, provide default
        throw new Error(errorData.detail || `HTTP error! status: ${calcResponse.status}`);
      }

      const calcData: CalculationResult = await calcResponse.json();
      setCalculationResult(calcData); // Use correct setter

      // Fetch OHLC data for the chart
      try {
        const ohlcResponse = await fetch('http://localhost:8000/ohlc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ start_date: startDate, end_date: endDate, ticker: '^GSPC' }), // Using S&P 500 ticker
        });

        if (ohlcResponse.ok) {
          const ohlcResult = await ohlcResponse.json();
          // Parse dates for the chart library
          const parsedOhlcData = ohlcResult.data.map((d: any) => ({
            ...d,
            // Ensure Date is parsed correctly into a Date object
            date: new Date(d.Date) // Directly parse the date string
          })).sort((a: OHLCData, b: OHLCData) => a.date.getTime() - b.date.getTime()); // Sort ascending by date
          setOhlcData(parsedOhlcData); // Use correct setter
        } else {
          const errorText = await ohlcResponse.text();
          console.error('Failed to fetch OHLC data:', errorText);
          setError(`Failed to fetch chart data: ${errorText}`);
          setOhlcData([]); // Clear chart on error
        }
      } catch (ohlcError) {
        console.error('Error fetching OHLC data:', ohlcError);
        setError('An error occurred while fetching chart data.');
        setOhlcData([]);
      }

    // Removed duplicate catch block
    } catch (err) {
      if (err instanceof Error) {
        setError(`Operation failed: ${err.message}`);
      } else {
        setError('An unexpected error occurred.');
      }
      console.error('Operation error:', err);
      // Ensure state is cleared on error
      setCalculationResult(null);
      setOhlcData([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format date for display (keep as is)
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Prepare data for the chart
  const { data: chartData, xScale, xAccessor, displayXAccessor } = discontinuousTimeScaleProvider
    .inputDateAccessor((d: OHLCData) => d.date)
    (ohlcData); // Use ohlcData state

  // Define chart dimensions (can be responsive)
  const chartHeight = 400;
  const chartMargin = { left: 50, right: 50, top: 10, bottom: 30 };

  // Removed ResponsiveChart component definition using fitWidth

  return (
    <div className="App">
      <header className="App-header">
        <h1>S&P 500 Performance Calculator</h1>
      </header>
      <main>
        <div className="input-section card">
          <h2>Enter Parameters</h2>
          <div className="input-group">
            <label htmlFor="startDate">Start Date:</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start Date"
            />
          </div>
          <div className="input-group">
            <label htmlFor="endDate">End Date:</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End Date"
            />
          </div>
          <div className="input-group">
            <label htmlFor="initialInvestment">Initial Investment ($):</label>
            <input
              type="number"
              id="initialInvestment"
              value={initialInvestment}
              onChange={(e) => setInitialInvestment(Number(e.target.value))}
              min="1"
              aria-label="Initial Investment"
            />
          </div>
          <button onClick={fetchData} disabled={loading || !startDate || !endDate}>
            {loading ? 'Calculating...' : 'Calculate Performance'}
          </button>
        </div>

        {error && (
          <div className="error-message card">
            <p>{error}</p>
          </div>
        )}

        {calculationResult && (
          <div className="calculation-results card">
            <h3>Calculation Results</h3>
            {/* Use state variables for dates */} 
            <p><strong>Period:</strong> {startDate} to {endDate}</p>
            <p><strong>Total Return:</strong> {calculationResult.totalReturn.toFixed(2)}%</p>
            <p><strong>CAGR:</strong> {calculationResult.cagr.toFixed(2)}%</p>
            <hr />
            <p><strong>Max Drawdown:</strong> {calculationResult.maxDrawdown.toFixed(2)}%</p>
            <p><strong>Max Drawdown Period:</strong> {calculationResult.maxDrawdownPeriod}</p>
            <hr />
            <p><strong>Volatility (Annualized):</strong> {calculationResult.volatility.toFixed(2)}%</p>
            <p><strong>Sharpe Ratio:</strong> {calculationResult.sharpeRatio.toFixed(2)}</p>
            <p><strong>Sortino Ratio:</strong> {calculationResult.sortinoRatio.toFixed(2)}</p>
            <p><strong>Calmar Ratio:</strong> {calculationResult.calmarRatio.toFixed(2)}</p>
            <hr />
            <p><strong>Best Month Return:</strong> {calculationResult.bestMonthReturn.toFixed(2)}%</p>
            <p><strong>Worst Month Return:</strong> {calculationResult.worstMonthReturn.toFixed(2)}%</p>
            <p><strong>Average Monthly Return:</strong> {calculationResult.avgMonthlyReturn.toFixed(2)}%</p>
            <p><strong>Positive Months:</strong> {calculationResult.positiveMonths}</p>
            <p><strong>Negative Months:</strong> {calculationResult.negativeMonths}</p>
            <small>Note: Ratios assume a risk-free rate of 0%. Monthly returns are based on calendar months.</small>
          </div>
        )}

        {/* Use ohlcData to check if chart should render */}
        {ohlcData.length > 0 && (
          <div className="chart-container card">
             <h3>S&P 500 Price Chart</h3>
             {/* Render ChartCanvas directly */}
             {/* You might need a container div with specific width/height */}
             {/* For now, let's assume the container provides dimensions */}
             <ChartCanvas
                height={chartHeight}
                ratio={window.devicePixelRatio} // Use device pixel ratio
                width={600} // Temporary fixed width - adjust as needed or make responsive via CSS/container
                margin={chartMargin}
                data={chartData}
                xScale={xScale}
                xAccessor={xAccessor}
                displayXAccessor={displayXAccessor}
                seriesName="S&P 500"
                xExtents={chartData.length > 0 ? [xAccessor(chartData[0]), xAccessor(chartData[chartData.length - 1])] : undefined}
              >
                <Chart id={1} yExtents={(d: OHLCData) => [d.high, d.low]}>
                  <XAxis axisAt="bottom" orient="bottom" ticks={6} />
                  <YAxis axisAt="left" orient="left" ticks={5} />
                  <CandlestickSeries
                    // width prop removed - using default or library's internal logic
                    fill={(d: OHLCData) => (d.close > d.open ? '#26a69a' : '#ef5350')}
                    stroke={(d: OHLCData) => (d.close > d.open ? '#26a69a' : '#ef5350')}
                    wickStroke={(d: OHLCData) => (d.close > d.open ? '#26a69a' : '#ef5350')}
                  />
                  <MouseCoordinateX
                    at="bottom"
                    orient="bottom"
                    displayFormat={timeFormat("%Y-%m-%d")} />
                  <MouseCoordinateY
                    at="left"
                    orient="left"
                    displayFormat={d3Format(".2f")} />
                </Chart>
                <CrossHairCursor />
              </ChartCanvas>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
