import React, { useState, useMemo } from 'react'
import styled from 'styled-components'
import { parseNumber, formatCurrency } from '../../utils/format'
import { calcMonthlyPayment } from '../../utils/loan'
import { CALC_CONFIG } from './calculatorConfig'

const CalculatorContainer = styled.div`
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const CalculatorInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const CalculatorLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #495057;
`

const CalculatorInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`

const CalculatorSlider = styled.input`
  width: 100%;
  margin: 10px 0;
`

const CalculatorPercent = styled.div`
  font-size: 12px;
  color: #6c757d;
  text-align: center;
`

const CalculatorConfigSection = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  font-size: 14px;
  line-height: 1.5;
  color: #495057;
`

const CalculatorResultSection = styled.div`
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 8px;
  padding: 15px;
  font-size: 14px;
  line-height: 1.5;
  color: #155724;
  font-weight: 600;
`

const Calculator: React.FC = () => {
    const [price, setPrice] = useState<number>(300000)
    const [deposit, setDeposit] = useState<number>(60000)
    const [lastChanged, setLastChanged] = useState<'price' | 'deposit' | 'slider'>('price')

    const depositPercent = useMemo(() => {
        if (!price)
            return 0
        return Math.min(100, Math.max(0, deposit / price * 100))
    }, [deposit, price])

    const onPriceChange = (value: string) => {
        const num = parseNumber(value)
        setPrice(num)
        setLastChanged('price')

        if (lastChanged === 'slider') {
            const newDeposit = Math.round(num * depositPercent / 100)
            setDeposit(newDeposit)
        }
    }

    const onDepositChange = (value: string) => {
        const num = parseNumber(value)
        setDeposit(num)
        setLastChanged('deposit')
    }

    const onSliderChange = (value: string) => {
        const percent = Number(value)
        const newDeposit = Math.round(price * percent / 100)
        setDeposit(newDeposit)
        setLastChanged('slider')
    }

    const monthlyRate = CALC_CONFIG.annualRate / 12
    const principal = price - deposit
    const monthlyLoan = calcMonthlyPayment(principal, monthlyRate, CALC_CONFIG.loanMonths)
    const monthlyInsurance = price * CALC_CONFIG.insuranceRate / 12
    const totalMonthly = monthlyLoan + monthlyInsurance + CALC_CONFIG.trackingFee

    return (
        <CalculatorContainer>
            <CalculatorInputGroup>
                <CalculatorLabel>Vehicle Price</CalculatorLabel>
                <CalculatorInput
                    value={formatCurrency(price)}
                    onChange={e => onPriceChange(e.target.value)}
                />
            </CalculatorInputGroup>

            <CalculatorInputGroup>
                <CalculatorLabel>Deposit Amount</CalculatorLabel>
                <CalculatorInput
                    value={formatCurrency(deposit)}
                    onChange={e => onDepositChange(e.target.value)}
                />
                <CalculatorSlider
                    type="range"
                    min="0"
                    max="100"
                    value={depositPercent}
                    onChange={e => onSliderChange(e.target.value)}
                />
                <CalculatorPercent>{depositPercent.toFixed(1)}%</CalculatorPercent>
            </CalculatorInputGroup>

            <CalculatorConfigSection>
                <div>Loan Term: {CALC_CONFIG.loanMonths} months</div>
                <div>Interest Rate: {(CALC_CONFIG.annualRate * 100).toFixed(1)}% annually</div>
                <div>Monthly Rate: {(monthlyRate * 100).toFixed(3)}% monthly</div>
                <div>Warranty Cost: {formatCurrency(CALC_CONFIG.warrantyCost)}</div>
                <div>Insurance Rate: {(CALC_CONFIG.insuranceRate * 100).toFixed(1)}% annually</div>
                <div>Tracking Fee: {formatCurrency(CALC_CONFIG.trackingFee)} monthly</div>
            </CalculatorConfigSection>

            <CalculatorResultSection>
                <div>Monthly Loan: {formatCurrency(Math.round(monthlyLoan))}</div>
                <div>Monthly Insurance: {formatCurrency(Math.round(monthlyInsurance))}</div>
                <div>Total Monthly: {formatCurrency(Math.round(totalMonthly))}</div>
            </CalculatorResultSection>
        </CalculatorContainer>
    )
}

export default Calculator
