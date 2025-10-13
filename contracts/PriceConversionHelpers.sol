// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Convert token/native amounts <-> USD <-> other native tokens
/// @dev All USD conversions are standardized to 18 decimals for cross-chain accuracy
abstract contract PriceConversionHelpers {
    /// -----------------------------------------------------------------------
    /// Abstract oracle reader — must be implemented by inheriting contract
    /// -----------------------------------------------------------------------
    function _getPrice(bytes32 priceKey) internal view virtual returns (uint256 price, uint8 decimals);

    /// -----------------------------------------------------------------------
    /// TOKEN -> USD (scaled to 18 decimals)
    /// -----------------------------------------------------------------------
    function _tokenAmountToUsdScaled18(
        uint256 amount,
        uint8 tokenDecimals,
        bytes32 tokenUsdKey
    ) internal view returns (uint256 usd18) {
        require(amount > 0, "Zero token amount");
        (uint256 price, uint8 priceDecimals) = _getPrice(tokenUsdKey);
        require(price > 0, "Invalid price");
        require(priceDecimals <= 18 && tokenDecimals <= 18, "Unsupported decimals");

        /**
         * Example:
         * - amount = 1e6 (USDC, 6 decimals)
         * - price = 1e8 (USD = 1.00, 8 decimals)
         * usd18 = (1e6 * 1e8 * 1e(18 - 6)) / 1e8 = 1e18 ✅
         */
        usd18 = (amount * price * (10 ** (18 - tokenDecimals))) / (10 ** priceDecimals);
    }

    /// -----------------------------------------------------------------------
    /// SOURCE NATIVE (e.g., HBAR) -> USD (scaled 18)
    /// -----------------------------------------------------------------------
    function _nativeToUsdScaled18(
        uint256 nativeAmount,
        bytes32 nativeUsdKey
    ) internal view returns (uint256 usd18) {
        require(nativeAmount > 0, "Zero native amount");
        (uint256 price, uint8 priceDecimals) = _getPrice(nativeUsdKey);
        require(price > 0, "Invalid native price");
        require(priceDecimals <= 18, "Unsupported decimals");

        /**
         * Assume native has 18 decimals.
         * Example: 1 HBAR = $0.08 → price = 8_000_000 (8 decimals)
         * usd18 = (1e18 * 8e6 * 1e10) / 1e8 = 8e16 ✅
         */
        usd18 = (nativeAmount * price * (10 ** (18 - priceDecimals))) / 1e18;
    }

    /// -----------------------------------------------------------------------
    /// USD (scaled 18) -> DESTINATION NATIVE
    /// -----------------------------------------------------------------------
    function _usdScaled18ToNative(
        uint256 usd18,
        bytes32 dstNativeUsdKey
    ) internal view returns (uint256 nativeAmount) {
        require(usd18 > 0, "Zero USD amount");
        (uint256 dstPrice, uint8 dstPriceDecimals) = _getPrice(dstNativeUsdKey);
        require(dstPrice > 0, "Invalid destination price");
        require(dstPriceDecimals <= 18, "Unsupported decimals");

        /**
         * Example:
         * usd18 = 1e20 ($100)
         * dstPrice = 2e11 (ETH = $2000, 8 decimals)
         * nativeAmount = (1e20 * 1e8) / 2e11 = 5e16 → 0.05 ETH ✅
         */
        nativeAmount = (usd18 * (10 ** dstPriceDecimals)) / dstPrice;
    }
    
    
}
