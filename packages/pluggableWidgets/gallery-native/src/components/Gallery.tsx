import { ReactElement, ReactNode, useCallback, useMemo, useState } from "react";
import { Text, Pressable, View, ViewProps, Platform, TouchableOpacity, useWindowDimensions } from "react-native";
import { ObjectItem, DynamicValue } from "mendix";
import DeviceInfo from "react-native-device-info";
import { GalleryStyle } from "../ui/Styles";
import { PaginationEnum, ScrollDirectionEnum } from "../../typings/GalleryProps";
import { isAvailable } from "@mendix/piw-utils-internal";
import { extractStyles } from "@mendix/pluggable-widgets-tools";
import { FlashList } from "@shopify/flash-list";

const DEFAULT_RIPPLE_COLOR = "rgba(0, 0, 0, 0.2)";

export interface GalleryProps<T extends ObjectItem> {
    emptyPlaceholder?: ReactNode;
    hasMoreItems: boolean;
    itemRenderer: (renderWrapper: (children: ReactNode, onClick?: () => void) => ReactElement, item: T) => ReactElement;
    items: T[] | undefined;
    loadMoreItems: () => void;
    filters?: ReactNode;
    name: string;
    pagination: PaginationEnum;
    loadMoreButtonCaption?: DynamicValue<string>;
    phoneColumns: number;
    pullDown?: () => void;
    pullDownIsExecuting?: boolean;
    scrollDirection: ScrollDirectionEnum;
    style: GalleryStyle;
    tabletColumns: number;
}

export const Gallery = <T extends ObjectItem>(props: GalleryProps<T>): ReactElement => {
    const isScrollDirectionVertical = props.scrollDirection === "vertical";
    const numColumns = DeviceInfo.isTablet() ? props.tabletColumns : props.phoneColumns;
    const firstItemId = props.items?.[0]?.id;
    const lastItemId = props.items?.[props.items.length - 1]?.id;
    const { name, style, itemRenderer } = props;
    const { width } = useWindowDimensions();

    // FlashList does not derive the height of a horizontal list from its content the way the old
    // FlatList did: for a horizontal list it forces every cell to the list's own cross-axis height.
    // When the list has no bounded height it collapses and clips the items. To restore the previous
    // behavior we measure the natural height of an item off-list (unconstrained) and apply it as the
    // list height. This keeps horizontal galleries working without requiring a bounded parent.
    const [measuredItemHeight, setMeasuredItemHeight] = useState<number>();
    const measureItem = props.items?.[0];

    const onEndReached = (): void => {
        if (props.pagination === "virtualScrolling" && props.hasMoreItems) {
            props.loadMoreItems();
        }
    };

    const renderItem = useCallback(
        (item: { item: T }): ReactElement =>
            itemRenderer((children, onPress) => {
                const itemStyle = isScrollDirectionVertical ? undefined : { width };
                const listItemWrapperProps: ViewProps = {
                    style: itemStyle,
                    testID: `${name}-list-item-${item.item.id}`
                };
                const renderListItemContent = (
                    <View
                        style={[
                            style.listItem,
                            firstItemId === item.item.id && style.firstItem,
                            lastItemId === item.item.id && style.lastItem
                        ]}
                    >
                        {children}
                    </View>
                );
                return onPress ? (
                    <Pressable {...listItemWrapperProps} onPress={onPress}>
                        {renderListItemContent}
                    </Pressable>
                ) : (
                    <View {...listItemWrapperProps}>{renderListItemContent}</View>
                );
            }, item.item),
        [
            itemRenderer,
            isScrollDirectionVertical,
            width,
            name,
            style.listItem,
            style.firstItem,
            style.lastItem,
            firstItemId,
            lastItemId
        ]
    );

    const loadMoreButton = useMemo((): ReactElement | null => {
        const renderButton = (
            <Text style={props.style.loadMoreButtonCaption}>
                {props.loadMoreButtonCaption && isAvailable(props.loadMoreButtonCaption)
                    ? props.loadMoreButtonCaption.value
                    : "Load more"}
            </Text>
        );

        const [pressableRippleProps, loadMoreButtonContainerStyle] = extractStyles(
            props.style.loadMoreButtonPressableContainer,
            ["rippleColor", "borderless", "radius", "foreground"]
        );

        const buttonProps = {
            testID: `${name}-pagination-button`,
            onPress: () => props.hasMoreItems && props.loadMoreItems && props.loadMoreItems(),
            style: loadMoreButtonContainerStyle
        };

        return props.pagination === "buttons" && props.hasMoreItems ? (
            Platform.OS === "android" ? (
                <Pressable
                    {...buttonProps}
                    {...(pressableRippleProps
                        ? {
                              android_ripple: {
                                  ...pressableRippleProps,
                                  color: pressableRippleProps.rippleColor ?? DEFAULT_RIPPLE_COLOR
                              }
                          }
                        : {})}
                >
                    {renderButton}
                </Pressable>
            ) : (
                <TouchableOpacity {...buttonProps}>{renderButton}</TouchableOpacity>
            )
        ) : null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        props.style.loadMoreButtonCaption,
        props.loadMoreButtonCaption,
        props.style.loadMoreButtonPressableContainer,
        name,
        props.pagination,
        props.hasMoreItems,
        props.loadMoreItems
    ]);

    const renderEmptyPlaceholder = useMemo(
        (): ReactElement => <View style={props.style.emptyPlaceholder}>{props.emptyPlaceholder}</View>,
        [props.style.emptyPlaceholder, props.emptyPlaceholder]
    );

    return (
        <View testID={`${name}`} style={props.style.container}>
            {props.filters ? <View>{props.filters}</View> : null}
            {!isScrollDirectionVertical && measureItem ? (
                <View
                    style={{ position: "absolute", opacity: 0, left: 0, top: 0 }}
                    pointerEvents="none"
                    onLayout={event => {
                        const measured = event.nativeEvent.layout.height;
                        if (measured > 0) {
                            setMeasuredItemHeight(prev => (prev === undefined || measured > prev ? measured : prev));
                        }
                    }}
                >
                    {itemRenderer(children => <View style={style.listItem}>{children}</View>, measureItem)}
                </View>
            ) : null}
            <FlashList
                {...(isScrollDirectionVertical && props.pullDown ? { onRefresh: props.pullDown } : {})}
                {...(isScrollDirectionVertical ? { numColumns } : {})}
                ListFooterComponent={loadMoreButton}
                ListFooterComponentStyle={{
                    ...props.style.loadMoreButtonContainer,
                    ...(isScrollDirectionVertical ? { marginTop: 8 } : { marginStart: 8 })
                }}
                refreshing={props.pullDownIsExecuting}
                data={props.items}
                horizontal={!isScrollDirectionVertical}
                keyExtractor={item => item.id}
                ListEmptyComponent={renderEmptyPlaceholder}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.6}
                scrollEventThrottle={50}
                renderItem={renderItem}
                style={[
                    props.style.list,
                    !isScrollDirectionVertical && measuredItemHeight ? { height: measuredItemHeight } : undefined
                ]}
                testID={`${name}-list`}
            />
        </View>
    );
};
