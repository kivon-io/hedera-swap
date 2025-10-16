// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Convert token/native amounts <-> USD <-> other native tokens
/// @dev All USD conversions are standardized to 18 decimals for cross-chain accuracy
abstract contract PriceConversionHelpers {
    /// -----------------------------------------------------------------------
    /// Abstract oracle reader — must be implemented by inheriting contract
    /// -----------------------------------------------------------------------
    function _getPrice(address priceKey) internal view virtual returns (uint256 price, uint8 decimals);
    function getDestPrice(uint32 pairIndex) public view virtual returns (uint256 price, uint8 decimals); 
    /// -----------------------------------------------------------------------

    /// -----------------------------------------------------------------------
    /// TOKEN -> USD (scaled to 18 decimals)
    /// -----------------------------------------------------------------------
    function _tokenAmountToUsdScaled18(
        uint256 tokenAmount,
        address tokenAddress,
        uint8 tokenDecimals
    ) internal view returns (uint256 usd18) {
        require(tokenAmount > 0, "Zero token amount"); 
        (uint256 price, uint8 priceDecimals) = _getPrice(tokenAddress);
        
        require(price > 0, "Invalid price"); // Changed to "Invalid price" for generality
        require(priceDecimals <= 18, "Unsupported price decimals");
        require(tokenDecimals <= 18, "Unsupported token decimals"); // Changed to "Unsupported token decimals"
        
        uint256 denominator = (10 ** priceDecimals);
        uint256 numerator = tokenAmount * price * (10 ** (18 - tokenDecimals));

        usd18 = numerator / denominator;
    }

    /// -----------------------------------------------------------------------
    /// USD (scaled 18) -> DESTINATION NATIVE
    /// -----------------------------------------------------------------------
    function _usdScaled18ToNative(
        uint256 usd18,
        address dstNativeUsdKey, 
        uint32 pairIndex,
        uint8 dstNativeDecimals 
    ) internal view returns (uint256 nativeAmount) {
        require(usd18 > 0, "Zero USD amount");

        uint256 dstPrice;
        uint8 dstPriceDecimals; 

        if (dstNativeUsdKey != address(0)) {
            (dstPrice, dstPriceDecimals) = _getPrice(dstNativeUsdKey);
        } else {
            (dstPrice, dstPriceDecimals) = getDestPrice(pairIndex);
        }
        
        require(dstPrice > 0, "Invalid destination price");
        require(dstPriceDecimals <= 18, "Unsupported decimals");
        require(dstNativeDecimals <= 18, "Unsupported destination native decimals");

        // 1. Convert the USD price to a 18-decimal USD price
        uint256 priceUsd18 = (dstPrice * (10 ** (18 - dstPriceDecimals)));

        // 2. Scale the USD18 amount by the destination native token's decimals
        uint256 numerator = usd18 * (10 ** dstNativeDecimals);
        
        // 3. FINAL CORRECT CALCULATION
        // Formula: nativeAmount = (usd18 * 10^dstNativeDecimals) / priceUsd18
        nativeAmount = numerator / priceUsd18; 
    }
    
}
